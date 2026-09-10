"""Adapters for OpenAI and every server that speaks its Chat Completions API.

One base class, `OpenAICompatible`, plus thin subclasses for the servers whose
deviations matter:

    OpenAIProvider   api.openai.com (Chat Completions, or Responses API)
    VLLMProvider     max_model_len in /v1/models, `reasoning` field, extra_body
    LlamaCppProvider /props for the real context size, native sampler params
    DeepSeekProvider reasoning_content round-trip rule, /beta features
    AzureOpenAI      deployment-name-as-model, api-version query param

The base class is usable directly (`kind: openai_compatible`) for anything
else that exposes /v1/chat/completions.
"""

from __future__ import annotations

import json
from typing import Any, Iterable, Iterator, Optional, Union

from ..base import Provider
from ..config import ProviderConfig
from ..discovery import infer_capabilities, infer_family
from ..errors import (
    AuthError,
    CapabilityError,
    ConnectionError_,
    ContextLengthError,
    InvalidRequestError,
    LLMError,
    NotFoundError,
    OverloadedError,
    RateLimitError,
    ServerError,
    TimeoutError_,
)
from ..params import (
    Dropped,
    GenParams,
    harden_schema,
    scale_temperature,
    schema_to_dict,
    snap_effort,
    warn_dropped,
)
from ..types import (
    AudioPart,
    Capability,
    ChatResponse,
    FilePart,
    ImagePart,
    Message,
    ModelInfo,
    StreamChunk,
    TextPart,
    ToolCall,
    ToolDef,
    Usage,
    normalize_messages,
)


def _require_openai():
    try:
        import openai  # noqa: F401
    except ImportError as exc:  # pragma: no cover
        raise CapabilityError(
            "The `openai` package is required for OpenAI-compatible providers: "
            "pip install openai"
        ) from exc
    return __import__("openai")


class OpenAICompatible(Provider):
    """Chat Completions over any OpenAI-shaped endpoint."""

    kind = "openai_compatible"

    #: Sampling params this backend understands. Anything in GenParams not
    #: listed here is dropped (with a warning) rather than sent blind.
    supported = {
        "temperature", "top_p", "max_tokens", "stop", "seed",
        "presence_penalty", "frequency_penalty",
    }
    #: Of those, the ones that are NOT valid top-level Chat Completions params
    #: and must ride in `extra_body`. The openai SDK raises TypeError on an
    #: unknown top-level kwarg, so this split is not optional.
    via_extra_body: set[str] = set()
    temperature_max = 2.0
    #: Field carrying reasoning text on the response message.
    reasoning_field = "reasoning_content"
    effort_levels: list[str] = []

    def __init__(self, config: ProviderConfig) -> None:
        super().__init__(config)
        self._client = None
        self._aclient = None

    # ------------------------------------------------------------------
    # Clients
    # ------------------------------------------------------------------

    def _client_kwargs(self) -> dict[str, Any]:
        import httpx

        return {
            "api_key": self.config.effective_key(),
            "base_url": self.config.resolved_base_url(),
            "timeout": httpx.Timeout(
                self.config.timeout, connect=self.config.connect_timeout
            ),
            "max_retries": self.config.max_retries,
            "default_headers": self.config.extra_headers or None,
        }

    @property
    def client(self):
        if self._client is None:
            openai = _require_openai()
            self._client = openai.OpenAI(**self._client_kwargs())
        return self._client

    @property
    def aclient(self):
        if self._aclient is None:
            openai = _require_openai()
            self._aclient = openai.AsyncOpenAI(**self._client_kwargs())
        return self._aclient

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    def list_models(self) -> list[ModelInfo]:
        with self._translate_errors():
            page = self.client.models.list()
            return [self._model_info(m) for m in page]

    def _model_info(self, m: Any) -> ModelInfo:
        raw = m.model_dump() if hasattr(m, "model_dump") else dict(m)
        mid = raw.get("id", "")
        return ModelInfo(
            id=mid,
            provider=self.name,
            display_name=None,
            context_window=raw.get("max_model_len"),   # vLLM populates this
            capabilities=frozenset(infer_capabilities(mid, self.kind)),
            family=infer_family(mid),
            created=raw.get("created"),
            meta={
                "owned_by": raw.get("owned_by"),
                "capability_source": "inferred-from-id",
            },
            raw=raw,
        )

    # ------------------------------------------------------------------
    # Request building
    # ------------------------------------------------------------------

    def _build_messages(self, messages: Iterable[Union[Message, dict]]) -> list[dict]:
        """Convert normalized messages into OpenAI wire format."""
        out: list[dict] = []
        for m in normalize_messages(messages):
            if m.role == "tool":
                for tr in m.tool_results:
                    out.append(
                        {
                            "role": "tool",
                            "tool_call_id": tr.tool_call_id,
                            "content": tr.content
                            if isinstance(tr.content, str)
                            else _flatten_text(tr.content),
                        }
                    )
                continue

            entry: dict[str, Any] = {"role": m.role}
            if isinstance(m.content, str):
                entry["content"] = m.content
            else:
                entry["content"] = [self._content_part(p) for p in m.content]
            if m.name:
                entry["name"] = m.name
            if m.tool_calls:
                entry["tool_calls"] = [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.name,
                            "arguments": json.dumps(tc.arguments),
                        },
                    }
                    for tc in m.tool_calls
                ]
                # An assistant turn with tool_calls must still carry a content
                # key; several servers 400 without it.
                entry.setdefault("content", entry.get("content") or None)
            out.append(entry)
        return out

    def _content_part(self, p: Any) -> dict:
        if isinstance(p, TextPart):
            return {"type": "text", "text": p.text}
        if isinstance(p, ImagePart):
            url = p.url or p.to_data_uri()
            block: dict[str, Any] = {"type": "image_url", "image_url": {"url": url}}
            if p.detail:
                block["image_url"]["detail"] = p.detail
            return block
        if isinstance(p, AudioPart):
            return {
                "type": "input_audio",
                "input_audio": {"data": p.to_b64(), "format": p.format},
            }
        if isinstance(p, FilePart):
            if p.file_id:
                return {"type": "file", "file": {"file_id": p.file_id}}
            return {
                "type": "file",
                "file": {
                    "filename": p.filename or "document.pdf",
                    "file_data": f"data:{p.mime_type};base64,{p.to_b64()}",
                },
            }
        raise InvalidRequestError(f"Unsupported content part: {type(p)!r}")

    def _build_tools(self, tools: Optional[list[ToolDef]]) -> Optional[list[dict]]:
        if not tools:
            return None
        out = []
        for t in tools:
            fn: dict[str, Any] = {
                "name": t.name,
                "description": t.description,
                "parameters": harden_schema(t.parameters) if t.strict else t.parameters,
            }
            if t.strict:
                fn["strict"] = True
            out.append({"type": "function", "function": fn})
        return out

    def _build_tool_choice(self, choice: Any) -> Any:
        if choice is None:
            return None
        if isinstance(choice, str):
            return "required" if choice == "any" else choice
        if isinstance(choice, dict) and "name" in choice:
            return {"type": "function", "function": {"name": choice["name"]}}
        return choice

    def _build_params(
        self, p: GenParams, model: str
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """Translate GenParams -> (top-level kwargs, extra_body).

        Returns two dicts because vendor SDKs reject unknown top-level kwargs;
        anything non-standard has to ride in `extra_body`.
        """
        kw: dict[str, Any] = {}
        body: dict[str, Any] = {}
        dropped = Dropped()

        def take(name: str, value: Any, wire: Optional[str] = None) -> None:
            if value is None:
                return
            if name not in self.supported:
                dropped.append(name)
            elif name in self.via_extra_body:
                body[wire or name] = value
            else:
                kw[wire or name] = value

        temp = (
            p.temperature
            if self.config.native_temperature
            else scale_temperature(p.temperature, self.temperature_max)
        )
        take("temperature", temp)
        take("top_p", p.top_p)
        take("top_k", p.top_k)
        take("max_tokens", p.max_tokens)
        take("stop", p.stop)
        take("seed", p.seed)
        take("presence_penalty", p.presence_penalty)
        take("frequency_penalty", p.frequency_penalty)

        if p.reasoning_effort is not None:
            if self.effort_levels:
                kw["reasoning_effort"] = snap_effort(
                    p.reasoning_effort, self.effort_levels
                )
            else:
                dropped.append("reasoning_effort")

        if p.parallel_tool_calls is not None:
            kw["parallel_tool_calls"] = p.parallel_tool_calls

        if p.response_schema is not None:
            schema = schema_to_dict(p.response_schema)
            if p.strict_schema:
                schema = harden_schema(schema)
            kw["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": p.schema_name,
                    "schema": schema,
                    "strict": p.strict_schema,
                },
            }
        elif p.json_mode:
            kw["response_format"] = {"type": "json_object"}

        if p.cache_key:
            kw["prompt_cache_key"] = p.cache_key

        warn_dropped(self.name, model, dropped, self.config.strict_params)
        extra_body = (
            body
            | dict(p.for_provider(self.kind))
            | dict(p.for_provider(self.name))
        )
        return kw, extra_body

    # ------------------------------------------------------------------
    # Chat
    # ------------------------------------------------------------------

    def chat(
        self,
        messages: Iterable[Union[Message, dict]],
        *,
        model: Optional[str] = None,
        tools: Optional[list[ToolDef]] = None,
        params: Optional[GenParams] = None,
        **kwargs: Any,
    ) -> ChatResponse:
        model = self._resolve_model(model)
        p = self._params(params, **kwargs)
        kw, extra_body = self._build_params(p, model)
        tool_payload = self._build_tools(tools)
        if tool_payload:
            kw["tools"] = tool_payload
            tc = self._build_tool_choice(p.tool_choice)
            if tc is not None:
                kw["tool_choice"] = tc

        with self._translate_errors(model):
            resp = self.client.chat.completions.create(
                model=model,
                messages=self._build_messages(messages),
                **({"extra_body": extra_body} if extra_body else {}),
                **kw,
            )
        return self._parse_response(resp, model)

    def _parse_response(self, resp: Any, model: str) -> ChatResponse:
        choice = resp.choices[0] if resp.choices else None
        msg = getattr(choice, "message", None)
        text = (getattr(msg, "content", None) or "") if msg else ""

        thinking = None
        for candidate in (self.reasoning_field, "reasoning", "reasoning_content"):
            value = getattr(msg, candidate, None) if msg else None
            if value:
                thinking = value
                break

        tool_calls: list[ToolCall] = []
        for tc in (getattr(msg, "tool_calls", None) or []):
            tool_calls.append(
                ToolCall(
                    id=tc.id,
                    name=tc.function.name,
                    arguments=_loads(tc.function.arguments),
                    raw=tc.model_dump() if hasattr(tc, "model_dump") else {},
                )
            )

        return ChatResponse(
            text=text,
            thinking=thinking,
            tool_calls=tool_calls,
            finish_reason=_finish(getattr(choice, "finish_reason", None)),
            usage=self._parse_usage(getattr(resp, "usage", None)),
            model=getattr(resp, "model", model),
            provider=self.name,
            raw=resp,
        )

    def _parse_usage(self, u: Any) -> Usage:
        if not u:
            return Usage()
        raw = u.model_dump() if hasattr(u, "model_dump") else dict(u)
        prompt_details = raw.get("prompt_tokens_details") or {}
        completion_details = raw.get("completion_tokens_details") or {}
        return Usage(
            input_tokens=raw.get("prompt_tokens", 0) or 0,
            output_tokens=raw.get("completion_tokens", 0) or 0,
            reasoning_tokens=completion_details.get("reasoning_tokens", 0) or 0,
            # OpenAI reports cached tokens as a SUBSET of prompt_tokens; DeepSeek
            # reports an explicit hit/miss split that also sums to prompt_tokens.
            cached_read_tokens=(
                prompt_details.get("cached_tokens")
                or raw.get("prompt_cache_hit_tokens")
                or 0
            ),
            cached_write_tokens=prompt_details.get("cache_write_tokens", 0) or 0,
            cache_is_additive=False,
            raw=raw,
        )

    # ------------------------------------------------------------------
    # Streaming
    # ------------------------------------------------------------------

    def stream(
        self,
        messages: Iterable[Union[Message, dict]],
        *,
        model: Optional[str] = None,
        tools: Optional[list[ToolDef]] = None,
        params: Optional[GenParams] = None,
        **kwargs: Any,
    ) -> Iterator[StreamChunk]:
        model = self._resolve_model(model)
        p = self._params(params, **kwargs)
        kw, extra_body = self._build_params(p, model)
        tool_payload = self._build_tools(tools)
        if tool_payload:
            kw["tools"] = tool_payload
            tc = self._build_tool_choice(p.tool_choice)
            if tc is not None:
                kw["tool_choice"] = tc

        with self._translate_errors(model):
            stream = self.client.chat.completions.create(
                model=model,
                messages=self._build_messages(messages),
                stream=True,
                # Without this, the final usage chunk never arrives. Supported by
                # OpenAI, vLLM, llama.cpp and Ollama's /v1 layer; harmless
                # elsewhere because unknown stream_options are ignored.
                stream_options={"include_usage": True},
                **({"extra_body": extra_body} if extra_body else {}),
                **kw,
            )

            yield StreamChunk(type="start", model=model)

            # Tool-call arguments arrive as string fragments keyed by index.
            partial: dict[int, dict[str, Any]] = {}
            usage = Usage()
            finish: Optional[str] = None

            for chunk in stream:
                if getattr(chunk, "usage", None):
                    usage = self._parse_usage(chunk.usage)
                if not chunk.choices:
                    continue
                choice = chunk.choices[0]
                delta = getattr(choice, "delta", None)
                if choice.finish_reason:
                    finish = choice.finish_reason
                if delta is None:
                    continue

                for field_name in (self.reasoning_field, "reasoning", "reasoning_content"):
                    think = getattr(delta, field_name, None)
                    if think:
                        yield StreamChunk(type="thinking", text=think, model=model)
                        break

                if getattr(delta, "content", None):
                    yield StreamChunk(type="text", text=delta.content, model=model)

                for tc in (getattr(delta, "tool_calls", None) or []):
                    slot = partial.setdefault(
                        tc.index, {"id": "", "name": "", "args": ""}
                    )
                    if tc.id:
                        slot["id"] = tc.id
                    if tc.function and tc.function.name:
                        slot["name"] = tc.function.name
                    if tc.function and tc.function.arguments:
                        slot["args"] += tc.function.arguments

            yield from _tool_call_chunks(partial, model)

            yield StreamChunk(
                type="done", usage=usage, finish_reason=_finish(finish), model=model
            )

    # ------------------------------------------------------------------
    # Embeddings
    # ------------------------------------------------------------------

    def embed(
        self, texts: list[str], *, model: Optional[str] = None, **kwargs: Any
    ) -> list[list[float]]:
        model = model or self.config.meta.get("embedding_model") or self._resolve_model(None)
        with self._translate_errors(model):
            resp = self.client.embeddings.create(model=model, input=texts, **kwargs)
        return [d.embedding for d in resp.data]

    # ------------------------------------------------------------------
    # Async
    # ------------------------------------------------------------------

    async def alist_models(self) -> list[ModelInfo]:
        with self._translate_errors():
            page = await self.aclient.models.list()
            return [self._model_info(m) async for m in page]

    async def achat(
        self,
        messages: Iterable[Union[Message, dict]],
        *,
        model: Optional[str] = None,
        tools: Optional[list[ToolDef]] = None,
        params: Optional[GenParams] = None,
        **kwargs: Any,
    ) -> ChatResponse:
        model = self._resolve_model(model)
        p = self._params(params, **kwargs)
        kw, extra_body = self._build_params(p, model)
        tool_payload = self._build_tools(tools)
        if tool_payload:
            kw["tools"] = tool_payload
            tc = self._build_tool_choice(p.tool_choice)
            if tc is not None:
                kw["tool_choice"] = tc
        with self._translate_errors(model):
            resp = await self.aclient.chat.completions.create(
                model=model,
                messages=self._build_messages(messages),
                **({"extra_body": extra_body} if extra_body else {}),
                **kw,
            )
        return self._parse_response(resp, model)

    async def astream(self, messages, **kw):  # type: ignore[override]
        model = self._resolve_model(kw.pop("model", None))
        tools = kw.pop("tools", None)
        p = self._params(kw.pop("params", None), **kw)
        params_kw, extra_body = self._build_params(p, model)
        tool_payload = self._build_tools(tools)
        if tool_payload:
            params_kw["tools"] = tool_payload
            tc = self._build_tool_choice(p.tool_choice)
            if tc is not None:
                params_kw["tool_choice"] = tc

        with self._translate_errors(model):
            stream = await self.aclient.chat.completions.create(
                model=model,
                messages=self._build_messages(messages),
                stream=True,
                stream_options={"include_usage": True},
                **({"extra_body": extra_body} if extra_body else {}),
                **params_kw,
            )
            yield StreamChunk(type="start", model=model)
            usage = Usage()
            finish = None
            partial: dict[int, dict[str, Any]] = {}

            async for chunk in stream:
                if getattr(chunk, "usage", None):
                    usage = self._parse_usage(chunk.usage)
                if not chunk.choices:
                    continue
                choice = chunk.choices[0]
                if choice.finish_reason:
                    finish = choice.finish_reason
                delta = getattr(choice, "delta", None)
                if delta is None:
                    continue

                for field_name in (
                    self.reasoning_field, "reasoning", "reasoning_content"
                ):
                    think = getattr(delta, field_name, None)
                    if think:
                        yield StreamChunk(type="thinking", text=think, model=model)
                        break

                if getattr(delta, "content", None):
                    yield StreamChunk(type="text", text=delta.content, model=model)

                for tc in (getattr(delta, "tool_calls", None) or []):
                    slot = partial.setdefault(
                        tc.index, {"id": "", "name": "", "args": ""}
                    )
                    if tc.id:
                        slot["id"] = tc.id
                    if tc.function and tc.function.name:
                        slot["name"] = tc.function.name
                    if tc.function and tc.function.arguments:
                        slot["args"] += tc.function.arguments

            for chunk in _tool_call_chunks(partial, model):
                yield chunk

            yield StreamChunk(
                type="done", usage=usage, finish_reason=_finish(finish), model=model
            )

    # ------------------------------------------------------------------
    # Error translation
    # ------------------------------------------------------------------

    def _translate_errors(self, model: str = ""):
        return _ErrorContext(self.name, model)


class _ErrorContext:
    """Context manager converting openai SDK exceptions into llmkit ones."""

    def __init__(self, provider: str, model: str = "") -> None:
        self.provider = provider
        self.model = model

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc is None or isinstance(exc, LLMError):
            return False
        try:
            import openai
        except ImportError:  # pragma: no cover
            return False

        ctx = {"provider": self.provider, "model": self.model, "raw": exc}
        rid = getattr(exc, "request_id", None)
        if rid:
            ctx["request_id"] = rid
        status = getattr(exc, "status_code", None)
        if status:
            ctx["status_code"] = status
        msg = str(exc)

        if isinstance(exc, openai.APITimeoutError):
            raise TimeoutError_(msg, **ctx) from exc
        if isinstance(exc, openai.APIConnectionError):
            raise ConnectionError_(msg, **ctx) from exc
        if isinstance(exc, openai.AuthenticationError | openai.PermissionDeniedError):
            raise AuthError(msg, **ctx) from exc
        if isinstance(exc, openai.NotFoundError):
            raise NotFoundError(msg, **ctx) from exc
        if isinstance(exc, openai.RateLimitError):
            retry_after = None
            headers = getattr(getattr(exc, "response", None), "headers", {}) or {}
            if "retry-after" in headers:
                try:
                    retry_after = float(headers["retry-after"])
                except (TypeError, ValueError):
                    pass
            raise RateLimitError(msg, retry_after=retry_after, **ctx) from exc
        if isinstance(exc, openai.BadRequestError | openai.UnprocessableEntityError):
            low = msg.lower()
            if "context" in low and ("length" in low or "window" in low or "size" in low):
                raise ContextLengthError(msg, **ctx) from exc
            raise InvalidRequestError(msg, **ctx) from exc
        if isinstance(exc, openai.InternalServerError):
            if status == 529:
                raise OverloadedError(msg, **ctx) from exc
            raise ServerError(msg, **ctx) from exc
        if isinstance(exc, openai.APIError):
            raise LLMError(msg, **ctx) from exc
        return False


# ==========================================================================
# Concrete providers
# ==========================================================================


class OpenAIProvider(OpenAICompatible):
    """api.openai.com.

    Two request surfaces exist. Chat Completions is the default here because
    it is the portable one — the same message shapes work against every local
    server. Set `use_responses_api: true` on the config to switch to
    /v1/responses, which is what OpenAI recommends for new projects and is
    required for built-in tools (web_search, file_search, code_interpreter)
    and for encrypted reasoning continuity. See references/openai.md.
    """

    kind = "openai"
    temperature_max = 2.0
    reasoning_field = "reasoning"
    effort_levels = ["none", "minimal", "low", "medium", "high", "xhigh", "max"]

    def _build_params(self, p: GenParams, model: str):
        kw, extra = super()._build_params(p, model)
        # Reasoning models reject sampling knobs outright rather than ignoring
        # them. Rather than maintain a model whitelist that goes stale, strip
        # them for any id that looks like a reasoning model and let the caller
        # override via extra_body if they know better.
        if _looks_like_reasoning(model):
            for key in ("temperature", "top_p", "presence_penalty",
                        "frequency_penalty", "logprobs", "top_logprobs"):
                kw.pop(key, None)
            # Chat Completions uses a flat string; Responses uses reasoning.effort.
            if p.max_tokens is not None:
                kw.pop("max_tokens", None)
                kw["max_completion_tokens"] = p.max_tokens
        return kw, extra

    def count_tokens(self, messages, *, model=None, **kwargs) -> int:
        """Local estimate via tiktoken — OpenAI has no counting endpoint.

        Falls back to a 4-chars-per-token heuristic when tiktoken is absent.
        """
        model = self._resolve_model(model)
        text = "\n".join(m.text() for m in normalize_messages(messages))
        try:
            import tiktoken

            try:
                enc = tiktoken.encoding_for_model(model)
            except KeyError:
                enc = tiktoken.get_encoding("o200k_base")
            # +4 tokens per message of envelope overhead, roughly.
            return len(enc.encode(text)) + 4 * len(list(normalize_messages(messages)))
        except ImportError:
            return len(text) // 4


class VLLMProvider(OpenAICompatible):
    """vLLM's OpenAI server.

    Two things worth knowing before debugging anything here:

    * `/v1/models` reports `max_model_len`, so context windows are real, not
      inferred. LoRA adapters appear as extra entries with `parent` set.
    * Tool calling silently does nothing unless the server was started with
      `--enable-auto-tool-choice --tool-call-parser <parser>`. There is no
      error: `tool_calls` is simply absent and the raw text lands in
      `content`. `check_tool_support()` below turns that into a real signal.
    """

    kind = "vllm"
    temperature_max = 2.0
    reasoning_field = "reasoning"   # renamed from reasoning_content in vLLM 0.12+
    supported = OpenAICompatible.supported | {"top_k", "repetition_penalty", "min_p"}
    via_extra_body = {"top_k", "repetition_penalty", "min_p"}

    def _model_info(self, m: Any) -> ModelInfo:
        info = super()._model_info(m)
        raw = info.raw
        meta = dict(info.meta)
        if raw.get("parent"):
            meta["lora_parent"] = raw["parent"]
            meta["is_lora_adapter"] = True
        if raw.get("root"):
            meta["root"] = raw["root"]
        if info.context_window:
            meta["capability_source"] = "server-reported(max_model_len)+inferred-caps"
        import dataclasses

        return dataclasses.replace(info, meta=meta)

    def _build_params(self, p: GenParams, model: str):
        kw, extra = super()._build_params(p, model)
        # vLLM's structured-outputs backend supersedes the removed guided_*
        # params. `response_format` also works; this form gives access to
        # regex/choice/grammar modes too.
        if p.response_schema is not None and "structured_outputs" not in extra:
            schema = schema_to_dict(p.response_schema)
            extra.setdefault("structured_outputs", {"json": schema})
            kw.pop("response_format", None)
        # Thinking on chat-template-driven models (Qwen3 and friends).
        if p.reasoning_effort in ("none", "minimal"):
            extra.setdefault("chat_template_kwargs", {"enable_thinking": False})
        elif p.reasoning_effort:
            extra.setdefault("chat_template_kwargs", {"enable_thinking": True})
        return kw, extra

    def check_tool_support(self, model: Optional[str] = None) -> bool:
        """Probe whether this server will actually emit tool calls.

        Sends a one-token request with a trivial forced tool. Cheap, and the
        only reliable way to distinguish "model can't" from "server wasn't
        started with --enable-auto-tool-choice".
        """
        probe = ToolDef(
            name="_probe",
            description="Return the number 1.",
            parameters={
                "type": "object",
                "properties": {"n": {"type": "integer"}},
                "required": ["n"],
            },
        )
        try:
            resp = self.chat(
                [Message.user("Call _probe with n=1.")],
                model=model,
                tools=[probe],
                params=GenParams(max_tokens=64, tool_choice={"name": "_probe"}),
            )
            return bool(resp.tool_calls)
        except LLMError:
            return False


class LlamaCppProvider(OpenAICompatible):
    """llama-server.

    `/v1/models` gives `meta.n_ctx_train` (what the model was *trained* with),
    which is NOT the context the server is actually running — that is divided
    across `--parallel` slots. `/props` has the real number, so discovery hits
    both and prefers `/props`.
    """

    kind = "llamacpp"
    temperature_max = 2.0
    supported = OpenAICompatible.supported | {
        "top_k", "min_p", "typical_p", "repeat_penalty",
    }
    via_extra_body = {"top_k", "min_p", "typical_p", "repeat_penalty"}

    def _http_root(self) -> str:
        url = (self.config.base_url or "http://localhost:8080").rstrip("/")
        return url[:-3].rstrip("/") if url.endswith("/v1") else url

    def props(self) -> dict[str, Any]:
        """GET /props — the authoritative source for running context size."""
        import httpx

        headers = dict(self.config.extra_headers)
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"
        try:
            r = httpx.get(
                f"{self._http_root()}/props",
                headers=headers,
                timeout=self.config.connect_timeout,
            )
            r.raise_for_status()
            return r.json()
        except Exception as exc:
            raise ConnectionError_(
                f"llama.cpp /props unreachable: {exc}", provider=self.name
            ) from exc

    def list_models(self) -> list[ModelInfo]:
        import dataclasses

        models = super().list_models()
        try:
            props = self.props()
        except LLMError:
            return models

        n_ctx = (props.get("default_generation_settings") or {}).get("n_ctx")
        modalities = props.get("modalities") or {}
        caps_extra: set[Capability] = set()
        if modalities.get("vision"):
            caps_extra.add(Capability.VISION)
        if modalities.get("audio"):
            caps_extra.add(Capability.AUDIO_IN)

        out = []
        for m in models:
            raw_meta = (m.raw.get("meta") or {}) if isinstance(m.raw, dict) else {}
            out.append(
                dataclasses.replace(
                    m,
                    context_window=n_ctx or raw_meta.get("n_ctx_train"),
                    capabilities=frozenset(m.capabilities | caps_extra),
                    meta={
                        **m.meta,
                        "n_ctx_train": raw_meta.get("n_ctx_train"),
                        "n_ctx_running": n_ctx,
                        "total_slots": props.get("total_slots"),
                        "model_path": props.get("model_path"),
                        "capability_source": "props+inferred",
                    },
                )
            )
        return out

    def _build_params(self, p: GenParams, model: str):
        kw, extra = super()._build_params(p, model)
        # llama.cpp takes a JSON Schema directly rather than via response_format.
        if p.response_schema is not None:
            extra.setdefault("json_schema", schema_to_dict(p.response_schema))
            kw.pop("response_format", None)
        return kw, extra


class DeepSeekProvider(OpenAICompatible):
    """api.deepseek.com.

    Two rules that produce hard 400s if you get them wrong:

    * `reasoning_content` must be echoed back on subsequent turns IF the
      assistant turn contained a tool call, and must be omitted otherwise.
      `_build_messages` implements exactly that.
    * `frequency_penalty` / `presence_penalty` are accepted but no-ops; in
      thinking mode `temperature` and `top_p` are no-ops too. They are dropped
      here so nobody spends an afternoon tuning a slider that does nothing.
    """

    kind = "deepseek"
    temperature_max = 2.0
    reasoning_field = "reasoning_content"
    supported = {"temperature", "top_p", "max_tokens", "stop"}

    def _build_messages(self, messages):
        out = super()._build_messages(messages)
        # A single normalized message can expand into several wire entries (one
        # tool turn -> one entry per tool_result), so index-based pairing
        # desyncs after the first tool round. Walk both lists with independent
        # cursors instead, matching only assistant turns.
        msgs = [m for m in normalize_messages(messages) if m.role == "assistant"]
        cursor = 0
        for entry in out:
            if entry.get("role") != "assistant":
                continue
            if cursor >= len(msgs):
                break
            source = msgs[cursor]
            cursor += 1
            # Echo reasoning back if and only if the turn contained a tool
            # call. Omitting it there is a 400; including it elsewhere is
            # ignored, but we stay strict so the rule stays visible.
            if source.thinking and entry.get("tool_calls"):
                entry["reasoning_content"] = source.thinking
        return out

    def beta_client(self):
        """A second client bound to /beta, for prefix and FIM completion."""
        openai = _require_openai()
        kwargs = self._client_kwargs()
        root = (self.config.base_url or "https://api.deepseek.com").rstrip("/")
        root = root[:-3].rstrip("/") if root.endswith("/v1") else root
        kwargs["base_url"] = f"{root}/beta"
        return openai.OpenAI(**kwargs)

    def fim(
        self, prefix: str, suffix: str = "", *, model: Optional[str] = None, **kw: Any
    ) -> str:
        """Fill-in-the-middle completion. Requires the /beta base URL."""
        model = self._resolve_model(model)
        with self._translate_errors(model):
            resp = self.beta_client().completions.create(
                model=model, prompt=prefix, suffix=suffix, **kw
            )
        return resp.choices[0].text

    def _parse_usage(self, u: Any) -> Usage:
        usage = super()._parse_usage(u)
        raw = usage.raw
        if "prompt_cache_hit_tokens" in raw:
            usage.cached_read_tokens = raw.get("prompt_cache_hit_tokens", 0) or 0
            usage.cache_is_additive = False
        return usage


class AzureOpenAIProvider(OpenAICompatible):
    """Azure OpenAI.

    `model` is a *deployment name*, not a model id, and deployments cannot be
    listed through the inference endpoint — discovery therefore falls back to
    `fallback_models` from config. Set those to your deployment names.
    """

    kind = "azure_openai"

    @property
    def client(self):
        if self._client is None:
            openai = _require_openai()
            self._client = openai.AzureOpenAI(
                api_key=self.config.effective_key(),
                azure_endpoint=self.config.base_url or "",
                api_version=self.config.api_version or "2024-10-21",
                timeout=self.config.timeout,
                max_retries=self.config.max_retries,
            )
        return self._client

    def list_models(self) -> list[ModelInfo]:
        # The data-plane endpoint has no deployment listing; the management
        # plane does, but needs different credentials. Configured names only.
        return [
            ModelInfo(
                id=name,
                provider=self.name,
                family=infer_family(name),
                capabilities=frozenset(infer_capabilities(name, self.kind)),
                meta={"capability_source": "configured-deployment"},
            )
            for name in self.config.fallback_models
        ]


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------


def _looks_like_reasoning(model: str) -> bool:
    import re

    return bool(re.match(r"^(o[1-9]|gpt-5)", model.lower()))


def _tool_call_chunks(partial: dict, model: str):
    """Turn the accumulated streaming slots into ``tool_call`` chunks.

    A slot that never received a function name is not a call. Some servers emit
    a stray delta beside the real one; forwarding it only buys a bogus "tool not
    found" observation downstream.
    """
    for slot in partial.values():
        if not slot["name"]:
            continue
        yield StreamChunk(
            type="tool_call",
            tool_call=ToolCall(
                id=slot["id"], name=slot["name"], arguments=_loads(slot["args"])
            ),
            model=model,
        )


def _loads(s: Any) -> dict:
    if isinstance(s, dict):
        return s
    if not s:
        return {}
    try:
        return json.loads(s)
    except (json.JSONDecodeError, TypeError):
        # A truncated stream or a model that emitted invalid JSON. Surface the
        # raw string rather than losing it — callers can decide what to do.
        return {"_raw": s, "_parse_error": True}


def _flatten_text(parts: Any) -> str:
    if isinstance(parts, str):
        return parts
    return "".join(p.text for p in parts if isinstance(p, TextPart))


_FINISH_MAP = {
    "stop": "stop",
    "length": "length",
    "tool_calls": "tool_calls",
    "function_call": "tool_calls",
    "content_filter": "content_filter",
}


def _finish(reason: Optional[str]) -> str:
    return _FINISH_MAP.get(reason or "", "unknown" if not reason else "stop")
