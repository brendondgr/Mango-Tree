"""Google Gemini adapter, via the `google-genai` SDK.

Use `google-genai` (`from google import genai`), never `google-generativeai` —
the latter was deprecated in Nov 2025 and most tutorial code on the internet
targets it. The two are not source-compatible.

Gemini's discovery data is the best of any provider: `client.models.list()`
returns `input_token_limit`, `output_token_limit` and `supported_actions` per
model, so nothing here is guessed.

The trap this adapter is mostly built around: a blocked prompt does NOT raise.
It returns a response with an empty `candidates` list, and touching `.text`
then fails confusingly. `_parse` checks for that and raises ContentFilterError.
"""

from __future__ import annotations

from typing import Any, Iterable, Iterator, Optional, Union

from ..base import Provider
from ..config import ProviderConfig
from ..discovery import infer_family
from ..errors import (
    AuthError,
    CapabilityError,
    ConnectionError_,
    ContentFilterError,
    ContextLengthError,
    InvalidRequestError,
    LLMError,
    NotFoundError,
    RateLimitError,
    ServerError,
)
from ..params import Dropped, GenParams, schema_to_dict, snap_effort, warn_dropped
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


def _require_genai():
    try:
        from google import genai  # noqa: F401
        from google.genai import types  # noqa: F401
    except ImportError as exc:  # pragma: no cover
        raise CapabilityError(
            "The `google-genai` package is required: pip install google-genai\n"
            "(NOT `google-generativeai`, which is deprecated and has a "
            "different API surface.)"
        ) from exc
    from google import genai
    from google.genai import types

    return genai, types


class GeminiProvider(Provider):
    kind = "gemini"

    #: Gemini 3.x effort ladder (`thinking_level`).
    effort_levels = ["minimal", "low", "medium", "high"]

    def __init__(self, config: ProviderConfig) -> None:
        super().__init__(config)
        self._client = None

    @property
    def client(self):
        if self._client is None:
            genai, types = _require_genai()
            kw: dict[str, Any] = {}
            if self.config.vertex:
                kw["vertexai"] = True
                if self.config.project:
                    kw["project"] = self.config.project
                kw["location"] = self.config.location or "us-central1"
            else:
                kw["api_key"] = self.config.effective_key()
            http: dict[str, Any] = {"timeout": int(self.config.timeout * 1000)}
            if self.config.base_url:
                http["base_url"] = self.config.base_url
            if self.config.extra_headers:
                http["headers"] = self.config.extra_headers
            kw["http_options"] = types.HttpOptions(**http)
            self._client = genai.Client(**kw)
        return self._client

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    def list_models(self) -> list[ModelInfo]:
        with _errors(self.name):
            return [self._model_info(m) for m in self.client.models.list()]

    def _model_info(self, m: Any) -> ModelInfo:
        # `name` is prefixed: "models/gemini-2.5-flash". The bare id is what
        # generate_content accepts, and what a dropdown should show.
        full = getattr(m, "name", "") or ""
        mid = full.split("/")[-1]
        actions = list(getattr(m, "supported_actions", None) or [])
        caps = self._capabilities(mid, actions, m)
        return ModelInfo(
            id=mid,
            provider=self.name,
            display_name=getattr(m, "display_name", None),
            context_window=getattr(m, "input_token_limit", None),
            max_output_tokens=getattr(m, "output_token_limit", None),
            capabilities=frozenset(caps),
            family=infer_family(mid),
            meta={
                "resource_name": full,
                "version": getattr(m, "version", None),
                "description": getattr(m, "description", None),
                "supported_actions": actions,
                "capability_source": "server-reported"
                if actions
                else "inferred-from-id",
            },
            raw={"name": full},
        )

    @staticmethod
    def _capabilities(mid: str, actions: list[str], m: Any) -> set[Capability]:
        from ..discovery import infer_capabilities

        caps: set[Capability] = set()
        acts = {a.lower() for a in actions}
        if any("generatecontent" in a for a in acts):
            caps |= {
                Capability.CHAT,
                Capability.TOOLS,
                Capability.STRUCTURED_OUTPUT,
                Capability.VISION,
                Capability.PDF,
                Capability.AUDIO_IN,
            }
        if any("embedcontent" in a for a in acts):
            caps.add(Capability.EMBEDDING)
            caps.discard(Capability.CHAT)
        if getattr(m, "thinking", False):
            caps.add(Capability.THINKING)
        if not caps:
            caps = infer_capabilities(mid, "gemini")
        caps.add(Capability.CACHING)
        return caps

    # ------------------------------------------------------------------
    # Conversion
    # ------------------------------------------------------------------

    def _contents(self, msgs: list[Message]) -> list[Any]:
        _, types = _require_genai()
        out = []
        for m in msgs:
            if m.role == "tool":
                out.append(
                    types.Content(
                        # Function responses go back as a USER turn.
                        role="user",
                        parts=[
                            types.Part.from_function_response(
                                name=tr.name or tr.tool_call_id,
                                response={"result": tr.content}
                                if isinstance(tr.content, str)
                                else {"result": str(tr.content)},
                            )
                            for tr in m.tool_results
                        ],
                    )
                )
                continue

            role = "model" if m.role == "assistant" else "user"
            parts: list[Any] = []

            # Thought signatures must survive round-tripping or Gemini 3
            # function calling 400s on the next turn.
            if m.thinking_raw:
                for p in m.thinking_raw:
                    parts.append(p)

            if isinstance(m.content, str):
                if m.content:
                    parts.append(types.Part.from_text(text=m.content))
            else:
                parts.extend(self._part(p, types) for p in m.content)

            for tc in m.tool_calls:
                parts.append(
                    types.Part(
                        function_call=types.FunctionCall(
                            name=tc.name, args=tc.arguments, id=tc.id or None
                        )
                    )
                )
            if parts:
                out.append(types.Content(role=role, parts=parts))
        return out

    def _part(self, p: Any, types: Any) -> Any:
        if isinstance(p, TextPart):
            return types.Part.from_text(text=p.text)
        if isinstance(p, ImagePart):
            if p.url:
                return types.Part(
                    file_data=types.FileData(
                        file_uri=p.url, mime_type=p.mime_type or "image/png"
                    )
                )
            return types.Part.from_bytes(
                data=p.data or b"", mime_type=p.mime_type or "image/png"
            )
        if isinstance(p, FilePart):
            if p.url:
                return types.Part(
                    file_data=types.FileData(file_uri=p.url, mime_type=p.mime_type)
                )
            return types.Part.from_bytes(data=p.data or b"", mime_type=p.mime_type)
        if isinstance(p, AudioPart):
            return types.Part.from_bytes(
                data=p.data or b"", mime_type=f"audio/{p.format}"
            )
        raise InvalidRequestError(f"Unsupported content part {type(p).__name__}")

    def _config(
        self,
        p: GenParams,
        model: str,
        system: Optional[str],
        tools: Optional[list[ToolDef]],
    ) -> Any:
        _, types = _require_genai()
        kw: dict[str, Any] = {}
        dropped = Dropped()

        if system:
            kw["system_instruction"] = system
        if p.temperature is not None:
            kw["temperature"] = p.temperature * 2.0  # Gemini's range is 0..2
        if p.top_p is not None:
            kw["top_p"] = p.top_p
        if p.top_k is not None:
            kw["top_k"] = p.top_k
        if p.max_tokens is not None:
            kw["max_output_tokens"] = p.max_tokens
        if p.stop:
            kw["stop_sequences"] = p.stop
        if p.seed is not None:
            kw["seed"] = p.seed
        for name in ("presence_penalty", "frequency_penalty"):
            if getattr(p, name, None) is not None:
                kw[name] = getattr(p, name)

        # Thinking. Gemini 3.x wants `thinking_level` (a string); 2.5.x wants
        # `thinking_budget` (an int). Sending both is a 400, so pick one by
        # model generation.
        if p.reasoning_effort or p.thinking_budget or p.include_thoughts:
            tc: dict[str, Any] = {}
            if _is_gemini_3(model):
                level = snap_effort(p.reasoning_effort or "medium", self.effort_levels)
                if level:
                    tc["thinking_level"] = level
                if p.thinking_budget:
                    dropped.append("thinking_budget (Gemini 3 uses thinking_level)")
            else:
                if p.thinking_budget is not None:
                    tc["thinking_budget"] = p.thinking_budget
                elif p.reasoning_effort == "none":
                    tc["thinking_budget"] = 0
                elif p.reasoning_effort:
                    tc["thinking_budget"] = -1     # dynamic
            if p.include_thoughts:
                tc["include_thoughts"] = True
            if tc:
                kw["thinking_config"] = types.ThinkingConfig(**tc)

        if p.response_schema is not None:
            kw["response_mime_type"] = "application/json"
            # response_json_schema accepts standard JSON Schema (incl. $ref);
            # response_schema takes the narrower OpenAPI subset. Prefer the
            # former for anything Pydantic generated.
            kw["response_json_schema"] = schema_to_dict(p.response_schema)
        elif p.json_mode:
            kw["response_mime_type"] = "application/json"

        if tools:
            kw["tools"] = [
                types.Tool(
                    function_declarations=[
                        types.FunctionDeclaration(
                            name=t.name,
                            description=t.description,
                            parameters_json_schema=t.parameters,
                        )
                        for t in tools
                    ]
                )
            ]
            # Passing explicit declarations means we execute tools ourselves;
            # disable the SDK's automatic-function-calling loop so the caller
            # stays in control.
            kw["automatic_function_calling"] = types.AutomaticFunctionCallingConfig(
                disable=True
            )
            if p.tool_choice is not None:
                kw["tool_config"] = types.ToolConfig(
                    function_calling_config=self._fc_config(p.tool_choice, types)
                )

        warn_dropped(self.name, model, dropped, self.config.strict_params)
        kw.update(p.for_provider(self.kind))
        kw.update(p.for_provider(self.name))
        return types.GenerateContentConfig(**kw)

    @staticmethod
    def _fc_config(choice: Any, types: Any) -> Any:
        if isinstance(choice, str):
            mode = {
                "auto": "AUTO", "none": "NONE", "any": "ANY", "required": "ANY",
            }.get(choice, "AUTO")
            return types.FunctionCallingConfig(mode=mode)
        if isinstance(choice, dict) and "name" in choice:
            return types.FunctionCallingConfig(
                mode="ANY", allowed_function_names=[choice["name"]]
            )
        return types.FunctionCallingConfig(mode="AUTO")

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
        system, msgs = self._split_system(messages)
        with _errors(self.name, model):
            resp = self.client.models.generate_content(
                model=model,
                contents=self._contents(msgs),
                config=self._config(p, model, system, tools),
            )
        return self._parse(resp, model)

    def _parse(self, resp: Any, model: str) -> ChatResponse:
        # A blocked prompt returns 200 with no candidates. Detect it before
        # anyone touches `.text`.
        candidates = getattr(resp, "candidates", None) or []
        if not candidates:
            fb = getattr(resp, "prompt_feedback", None)
            reason = getattr(fb, "block_reason", None)
            raise ContentFilterError(
                f"Gemini returned no candidates"
                + (f" (block_reason={reason})" if reason else "")
                + ". The prompt was most likely blocked by a safety filter.",
                provider=self.name,
                model=model,
                raw=resp,
            )

        cand = candidates[0]
        finish = str(getattr(cand, "finish_reason", "") or "")
        text_parts: list[str] = []
        thinking_parts: list[str] = []
        thinking_raw: list[Any] = []
        tool_calls: list[ToolCall] = []

        content = getattr(cand, "content", None)
        for part in (getattr(content, "parts", None) or []):
            if getattr(part, "function_call", None):
                fc = part.function_call
                tool_calls.append(
                    ToolCall(
                        id=getattr(fc, "id", "") or fc.name,
                        name=fc.name,
                        arguments=dict(fc.args or {}),
                    )
                )
                # The first function_call part must carry its thought
                # signature back on the next turn or Gemini 3 rejects it.
                if getattr(part, "thought_signature", None):
                    thinking_raw.append(part)
            elif getattr(part, "thought", False):
                thinking_parts.append(getattr(part, "text", "") or "")
                thinking_raw.append(part)
            elif getattr(part, "text", None):
                text_parts.append(part.text)

        resp_obj = ChatResponse(
            text="".join(text_parts),
            thinking="".join(thinking_parts) or None,
            tool_calls=tool_calls,
            finish_reason=_FINISH.get(finish.split(".")[-1].upper(), "unknown"),
            usage=self._usage(getattr(resp, "usage_metadata", None)),
            model=getattr(resp, "model_version", None) or model,
            provider=self.name,
            parsed=getattr(resp, "parsed", None),
            raw=resp,
        )
        if finish and finish.split(".")[-1].upper() in _BLOCKED:
            raise ContentFilterError(
                f"Generation stopped: finish_reason={finish}",
                provider=self.name, model=model, raw=resp,
            )
        return resp_obj

    @staticmethod
    def _usage(u: Any) -> Usage:
        if not u:
            return Usage()
        return Usage(
            input_tokens=getattr(u, "prompt_token_count", 0) or 0,
            output_tokens=getattr(u, "candidates_token_count", 0) or 0,
            reasoning_tokens=getattr(u, "thoughts_token_count", 0) or 0,
            cached_read_tokens=getattr(u, "cached_content_token_count", 0) or 0,
            cache_is_additive=False,
            raw={
                "total_token_count": getattr(u, "total_token_count", None),
                "tool_use_prompt_token_count": getattr(
                    u, "tool_use_prompt_token_count", None
                ),
            },
        )

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
        system, msgs = self._split_system(messages)
        with _errors(self.name, model):
            yield StreamChunk(type="start", model=model)
            usage = Usage()
            finish = "unknown"
            pending: list[ToolCall] = []
            for chunk in self.client.models.generate_content_stream(
                model=model,
                contents=self._contents(msgs),
                config=self._config(p, model, system, tools),
            ):
                if getattr(chunk, "usage_metadata", None):
                    usage = self._usage(chunk.usage_metadata)
                for cand in (getattr(chunk, "candidates", None) or []):
                    if getattr(cand, "finish_reason", None):
                        finish = _FINISH.get(
                            str(cand.finish_reason).split(".")[-1].upper(), "unknown"
                        )
                    content = getattr(cand, "content", None)
                    for part in (getattr(content, "parts", None) or []):
                        if getattr(part, "function_call", None):
                            fc = part.function_call
                            pending.append(
                                ToolCall(
                                    id=getattr(fc, "id", "") or fc.name,
                                    name=fc.name,
                                    arguments=dict(fc.args or {}),
                                )
                            )
                        elif getattr(part, "thought", False):
                            yield StreamChunk(
                                type="thinking",
                                text=getattr(part, "text", "") or "",
                                model=model,
                            )
                        elif getattr(part, "text", None):
                            yield StreamChunk(type="text", text=part.text, model=model)
            for tc in pending:
                yield StreamChunk(type="tool_call", tool_call=tc, model=model)
            yield StreamChunk(
                type="done", usage=usage, finish_reason=finish, model=model
            )

    def embed(
        self, texts: list[str], *, model: Optional[str] = None, **kwargs: Any
    ) -> list[list[float]]:
        _, types = _require_genai()
        model = model or self.config.meta.get("embedding_model", "gemini-embedding-001")
        cfg = types.EmbedContentConfig(**kwargs) if kwargs else None
        with _errors(self.name, model):
            resp = self.client.models.embed_content(
                model=model, contents=texts, config=cfg
            )
        return [e.values for e in resp.embeddings]

    def count_tokens(self, messages, *, model=None, **kwargs) -> int:
        model = self._resolve_model(model)
        _, msgs = self._split_system(messages)
        with _errors(self.name, model):
            resp = self.client.models.count_tokens(
                model=model, contents=self._contents(msgs)
            )
        return resp.total_tokens

    async def achat(self, messages, *, model=None, tools=None, params=None, **kwargs):
        model = self._resolve_model(model)
        p = self._params(params, **kwargs)
        system, msgs = self._split_system(messages)
        with _errors(self.name, model):
            resp = await self.client.aio.models.generate_content(
                model=model,
                contents=self._contents(msgs),
                config=self._config(p, model, system, tools),
            )
        return self._parse(resp, model)


# --------------------------------------------------------------------------


def _is_gemini_3(model: str) -> bool:
    import re

    m = re.search(r"gemini-(\d+)", model.lower())
    return bool(m and int(m.group(1)) >= 3)


_FINISH = {
    "STOP": "stop",
    "MAX_TOKENS": "length",
    "SAFETY": "content_filter",
    "PROHIBITED_CONTENT": "content_filter",
    "RECITATION": "content_filter",
    "BLOCKLIST": "content_filter",
    "SPII": "content_filter",
    "IMAGE_SAFETY": "content_filter",
    "MALFORMED_FUNCTION_CALL": "error",
    "OTHER": "unknown",
}

_BLOCKED = {
    "SAFETY", "PROHIBITED_CONTENT", "RECITATION", "BLOCKLIST", "SPII",
    "IMAGE_SAFETY",
}


class _errors:
    def __init__(self, provider: str, model: str = "") -> None:
        self.provider, self.model = provider, model

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc is None or isinstance(exc, LLMError):
            return False
        try:
            from google.genai import errors as gerr
        except ImportError:  # pragma: no cover
            return False
        if not isinstance(exc, gerr.APIError):
            return False

        code = getattr(exc, "code", None)
        msg = getattr(exc, "message", None) or str(exc)
        ctx = {
            "provider": self.provider, "model": self.model,
            "status_code": code, "raw": exc,
        }
        if code == 401 or code == 403:
            raise AuthError(msg, **ctx) from exc
        if code == 404:
            raise NotFoundError(msg, **ctx) from exc
        if code == 429:
            raise RateLimitError(msg, **ctx) from exc
        if code == 400:
            low = msg.lower()
            if "token" in low and ("exceed" in low or "limit" in low):
                raise ContextLengthError(msg, **ctx) from exc
            raise InvalidRequestError(msg, **ctx) from exc
        if code and code >= 500:
            raise ServerError(msg, **ctx) from exc
        if isinstance(exc, gerr.ServerError):
            raise ServerError(msg, **ctx) from exc
        if isinstance(exc, gerr.ClientError):
            raise InvalidRequestError(msg, **ctx) from exc
        raise LLMError(msg, **ctx) from exc
