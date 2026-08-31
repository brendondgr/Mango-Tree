"""Anthropic Messages API adapter.

Four differences from OpenAI drive most of this file:

  1. `max_tokens` is required, with no default. We supply one rather than
     letting the request 400.
  2. `system` is a top-level parameter, not a message role.
  3. Tool results go back as a **user** message containing `tool_result`
     content blocks — there is no `tool` role.
  4. Thinking blocks carry signatures and must be round-tripped unmodified
     across tool-use turns, or the next request 400s.
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
    schema_to_dict,
    snap_effort,
    warn_dropped,
)
from ..types import (
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

DEFAULT_MAX_TOKENS = 4096


def _require_anthropic():
    try:
        import anthropic  # noqa: F401
    except ImportError as exc:  # pragma: no cover
        raise CapabilityError(
            "The `anthropic` package is required: pip install anthropic"
        ) from exc
    return __import__("anthropic")


class AnthropicProvider(Provider):
    kind = "anthropic"

    #: Effort ladder used by 4.7+ models via output_config.effort.
    effort_levels = ["low", "medium", "high", "xhigh", "max"]

    def __init__(self, config: ProviderConfig) -> None:
        super().__init__(config)
        self._client = None
        self._aclient = None

    # ------------------------------------------------------------------

    def _client_kwargs(self) -> dict[str, Any]:
        kw: dict[str, Any] = {
            "api_key": self.config.effective_key(),
            "timeout": self.config.timeout,
            "max_retries": self.config.max_retries,
        }
        if self.config.base_url:
            kw["base_url"] = self.config.base_url
        if self.config.extra_headers:
            kw["default_headers"] = self.config.extra_headers
        return kw

    @property
    def client(self):
        if self._client is None:
            anthropic = _require_anthropic()
            self._client = anthropic.Anthropic(**self._client_kwargs())
        return self._client

    @property
    def aclient(self):
        if self._aclient is None:
            anthropic = _require_anthropic()
            self._aclient = anthropic.AsyncAnthropic(**self._client_kwargs())
        return self._aclient

    # ------------------------------------------------------------------
    # Discovery — the richest of any provider: real capabilities and limits
    # ------------------------------------------------------------------

    def list_models(self) -> list[ModelInfo]:
        with _errors(self.name):
            page = self.client.models.list(limit=100)
            return [self._model_info(m) for m in page]

    def _model_info(self, m: Any) -> ModelInfo:
        raw = m.model_dump() if hasattr(m, "model_dump") else dict(m)
        mid = raw.get("id", "")
        caps = self._capabilities(raw)
        created = raw.get("created_at")
        if isinstance(created, str):
            created = _iso_to_epoch(created)
        return ModelInfo(
            id=mid,
            provider=self.name,
            display_name=raw.get("display_name"),
            context_window=raw.get("max_input_tokens"),
            max_output_tokens=raw.get("max_tokens"),
            capabilities=frozenset(caps),
            family=infer_family(mid),
            created=created,
            meta={
                "capability_source": (
                    "server-reported" if raw.get("capabilities") else "inferred-from-id"
                ),
                "effort_levels": self._effort_levels(raw),
            },
            raw=raw,
        )

    @staticmethod
    def _capabilities(raw: dict[str, Any]) -> set[Capability]:
        """Translate the API's `capabilities` object into our enum.

        Anthropic returns a nested structure of `{"supported": bool}` objects.
        When the field is absent (older snapshots), fall back to inference.
        """
        cap_obj = raw.get("capabilities")
        if not isinstance(cap_obj, dict):
            from ..discovery import infer_capabilities

            return infer_capabilities(raw.get("id", ""))

        def on(key: str) -> bool:
            node = cap_obj.get(key)
            return bool(isinstance(node, dict) and node.get("supported"))

        caps = {Capability.CHAT, Capability.TOOLS}
        if on("image_input"):
            caps.add(Capability.VISION)
        if on("pdf_input"):
            caps.add(Capability.PDF)
        if on("thinking"):
            caps.add(Capability.THINKING)
        if on("structured_outputs"):
            caps.add(Capability.STRUCTURED_OUTPUT)
        if on("batch"):
            caps.add(Capability.BATCH)
        caps.add(Capability.CACHING)
        return caps

    @staticmethod
    def _effort_levels(raw: dict[str, Any]) -> list[str]:
        effort = (raw.get("capabilities") or {}).get("effort")
        if not isinstance(effort, dict):
            return []
        return [
            k
            for k, v in effort.items()
            if k != "supported" and isinstance(v, dict) and v.get("supported")
        ]

    # ------------------------------------------------------------------
    # Message conversion
    # ------------------------------------------------------------------

    def _build_messages(self, msgs: list[Message]) -> list[dict]:
        out: list[dict] = []
        for m in msgs:
            if m.role == "tool":
                # Tool results are a USER turn in Anthropic's model.
                blocks = [
                    {
                        "type": "tool_result",
                        "tool_use_id": tr.tool_call_id,
                        "content": tr.content
                        if isinstance(tr.content, str)
                        else [self._part(p) for p in tr.content],
                        **({"is_error": True} if tr.is_error else {}),
                    }
                    for tr in m.tool_results
                ]
                if out and out[-1]["role"] == "user" and isinstance(out[-1]["content"], list):
                    out[-1]["content"].extend(blocks)
                else:
                    out.append({"role": "user", "content": blocks})
                continue

            blocks: list[dict] = []

            # Thinking blocks must come FIRST in the assistant turn and be
            # byte-identical to what we received, signatures included.
            if m.role == "assistant" and m.thinking_raw:
                for b in m.thinking_raw:
                    blocks.append(b if isinstance(b, dict) else b.model_dump())

            if isinstance(m.content, str):
                if m.content:
                    blocks.append({"type": "text", "text": m.content})
            else:
                blocks.extend(self._part(p) for p in m.content)

            for tc in m.tool_calls:
                blocks.append(
                    {
                        "type": "tool_use",
                        "id": tc.id,
                        "name": tc.name,
                        "input": tc.arguments,
                    }
                )

            if not blocks:
                continue
            out.append({"role": m.role, "content": blocks})
        return out

    def _part(self, p: Any) -> dict:
        if isinstance(p, TextPart):
            return {"type": "text", "text": p.text}
        if isinstance(p, ImagePart):
            if p.url:
                return {"type": "image", "source": {"type": "url", "url": p.url}}
            return {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": p.mime_type or "image/png",
                    "data": p.to_b64(),
                },
            }
        if isinstance(p, FilePart):
            if p.file_id:
                return {
                    "type": "document",
                    "source": {"type": "file", "file_id": p.file_id},
                }
            if p.url:
                return {"type": "document", "source": {"type": "url", "url": p.url}}
            return {
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": p.mime_type,
                    "data": p.to_b64(),
                },
            }
        raise InvalidRequestError(
            f"Anthropic does not accept content part {type(p).__name__}"
        )

    def _build_tools(self, tools: Optional[list[ToolDef]]) -> Optional[list[dict]]:
        if not tools:
            return None
        return [
            {
                "name": t.name,
                "description": t.description,
                "input_schema": harden_schema(t.parameters) if t.strict else t.parameters,
                **({"strict": True} if t.strict else {}),
            }
            for t in tools
        ]

    def _build_params(
        self, p: GenParams, model: str, model_info: Optional[ModelInfo] = None
    ) -> dict[str, Any]:
        kw: dict[str, Any] = {}
        dropped = Dropped()

        # Required. Prefer the model's own reported ceiling when we know it.
        kw["max_tokens"] = (
            p.max_tokens
            or (model_info.max_output_tokens if model_info else None)
            or DEFAULT_MAX_TOKENS
        )

        if p.temperature is not None:
            # Anthropic's range is 0..1, unlike OpenAI's 0..2. GenParams is
            # already normalized to 0..1, so pass it through and clamp.
            kw["temperature"] = max(0.0, min(1.0, float(p.temperature)))
        if p.top_p is not None:
            kw["top_p"] = p.top_p
        if p.top_k is not None:
            kw["top_k"] = p.top_k
        if p.stop:
            kw["stop_sequences"] = p.stop
        for unsupported in ("seed", "presence_penalty", "frequency_penalty"):
            if getattr(p, unsupported, None) is not None:
                dropped.append(unsupported)

        # Reasoning. 4.7+ models use adaptive thinking + output_config.effort;
        # 4.6 and earlier use thinking.budget_tokens. Choosing wrongly 400s,
        # so key off the model's advertised effort levels when we have them.
        levels = (model_info.meta.get("effort_levels") if model_info else None) or []
        wants_thinking = (
            p.reasoning_effort not in (None, "none")
            or p.thinking_budget
            or p.include_thoughts
        )
        if wants_thinking:
            if not levels and not p.thinking_budget:
                # Discovery failed, or the model predates the capabilities
                # object. Assume the current mechanism rather than dropping the
                # request silently — a wrong guess produces a clear 400, while
                # silence produces a model that mysteriously stops reasoning.
                levels = self.effort_levels
            if levels:
                kw["thinking"] = {"type": "adaptive"}
                effort = snap_effort(p.reasoning_effort or "medium", levels)
                if effort:
                    kw["output_config"] = {"effort": effort}
            elif p.thinking_budget:
                budget = max(1024, int(p.thinking_budget))
                kw["thinking"] = {"type": "enabled", "budget_tokens": budget}
                # budget must be strictly below max_tokens in manual mode.
                if kw["max_tokens"] <= budget:
                    kw["max_tokens"] = budget + 1024
                # Sampling params are rejected alongside manual thinking.
                kw.pop("temperature", None)
                kw.pop("top_p", None)
                kw.pop("top_k", None)

        if p.tool_choice is not None:
            kw["tool_choice"] = self._tool_choice(p.tool_choice, p.parallel_tool_calls)
        elif p.parallel_tool_calls is False:
            kw["tool_choice"] = {"type": "auto", "disable_parallel_tool_use": True}

        if p.response_schema is not None:
            # Structured outputs where supported; otherwise fall back to a
            # forced single-tool call, which is the classic reliable trick.
            kw["output_config"] = {
                **kw.get("output_config", {}),
                "format": {
                    "type": "json_schema",
                    "schema": harden_schema(schema_to_dict(p.response_schema))
                    if p.strict_schema
                    else schema_to_dict(p.response_schema),
                },
            }

        warn_dropped(self.name, model, dropped, self.config.strict_params)
        kw.update(p.for_provider(self.kind))
        kw.update(p.for_provider(self.name))
        return kw

    @staticmethod
    def _tool_choice(choice: Any, parallel: Optional[bool]) -> dict:
        extra = {} if parallel is None else {"disable_parallel_tool_use": not parallel}
        if isinstance(choice, str):
            mapped = {"required": "any", "any": "any", "auto": "auto", "none": "none"}
            return {"type": mapped.get(choice, "auto"), **extra}
        if isinstance(choice, dict) and "name" in choice:
            return {"type": "tool", "name": choice["name"], **extra}
        return {"type": "auto", **extra}

    def _apply_cache(self, system: Any, messages: list[dict], p: GenParams) -> Any:
        """Place a cache breakpoint on the system prompt and the last message.

        Anthropic caching is explicit: nothing is cached unless a
        `cache_control` marker is present. Two breakpoints (system + tail) is
        the pattern that helps most conversations without burning the 4-slot
        budget.
        """
        if not p.cache_prompt:
            return system
        ttl = {"ttl": p.cache_ttl} if p.cache_ttl in ("5m", "1h") else {}
        marker = {"type": "ephemeral", **ttl}
        if isinstance(system, str) and system:
            system = [{"type": "text", "text": system, "cache_control": marker}]
        if messages:
            last = messages[-1]
            if isinstance(last.get("content"), list) and last["content"]:
                last["content"][-1]["cache_control"] = marker
        return system

    # ------------------------------------------------------------------
    # Chat
    # ------------------------------------------------------------------

    def _prepare(self, messages, model, tools, params, kwargs):
        model = self._resolve_model(model)
        p = self._params(params, **kwargs)
        system, msgs = self._split_system(messages)
        info = self._lookup(model)
        kw = self._build_params(p, model, info)
        wire = self._build_messages(msgs)
        system = self._apply_cache(system, wire, p)
        if system:
            kw["system"] = system
        tool_payload = self._build_tools(tools)
        if tool_payload:
            kw["tools"] = tool_payload
        return model, wire, kw

    def _lookup(self, model: str) -> Optional[ModelInfo]:
        """Cheap in-process memo of model metadata for max_tokens/effort."""
        cache = getattr(self, "_model_cache", None)
        if cache is None:
            try:
                cache = {m.id: m for m in self.list_models()}
            except LLMError:
                cache = {}
            self._model_cache = cache
        return cache.get(model)

    def chat(
        self,
        messages: Iterable[Union[Message, dict]],
        *,
        model: Optional[str] = None,
        tools: Optional[list[ToolDef]] = None,
        params: Optional[GenParams] = None,
        **kwargs: Any,
    ) -> ChatResponse:
        model, wire, kw = self._prepare(messages, model, tools, params, kwargs)
        with _errors(self.name, model):
            resp = self.client.messages.create(model=model, messages=wire, **kw)
        return self._parse(resp, model)

    def _parse(self, resp: Any, model: str) -> ChatResponse:
        text_parts: list[str] = []
        thinking_parts: list[str] = []
        thinking_raw: list[Any] = []
        tool_calls: list[ToolCall] = []

        for block in resp.content:
            btype = getattr(block, "type", None)
            if btype == "text":
                text_parts.append(block.text)
            elif btype == "thinking":
                thinking_parts.append(getattr(block, "thinking", "") or "")
                thinking_raw.append(block)
            elif btype == "redacted_thinking":
                thinking_raw.append(block)
            elif btype == "tool_use":
                tool_calls.append(
                    ToolCall(id=block.id, name=block.name, arguments=dict(block.input))
                )

        out = ChatResponse(
            text="".join(text_parts),
            thinking="".join(thinking_parts) or None,
            tool_calls=tool_calls,
            finish_reason=_FINISH.get(getattr(resp, "stop_reason", ""), "unknown"),
            usage=self._usage(getattr(resp, "usage", None)),
            model=getattr(resp, "model", model),
            provider=self.name,
            raw=resp,
        )
        if thinking_raw:
            out.raw = resp
        return out

    @staticmethod
    def _usage(u: Any) -> Usage:
        if not u:
            return Usage()
        raw = u.model_dump() if hasattr(u, "model_dump") else dict(u)
        details = raw.get("output_tokens_details") or {}
        return Usage(
            input_tokens=raw.get("input_tokens", 0) or 0,
            output_tokens=raw.get("output_tokens", 0) or 0,
            reasoning_tokens=details.get("thinking_tokens", 0) or 0,
            cached_read_tokens=raw.get("cache_read_input_tokens", 0) or 0,
            cached_write_tokens=raw.get("cache_creation_input_tokens", 0) or 0,
            # Anthropic reports cache tokens IN ADDITION to input_tokens.
            cache_is_additive=True,
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
        model, wire, kw = self._prepare(messages, model, tools, params, kwargs)
        with _errors(self.name, model):
            yield StreamChunk(type="start", model=model)
            with self.client.messages.stream(model=model, messages=wire, **kw) as s:
                for event in s:
                    etype = getattr(event, "type", "")
                    if etype == "content_block_delta":
                        d = event.delta
                        dtype = getattr(d, "type", "")
                        if dtype == "text_delta":
                            yield StreamChunk(type="text", text=d.text, model=model)
                        elif dtype == "thinking_delta":
                            yield StreamChunk(
                                type="thinking", text=d.thinking, model=model
                            )
                        # input_json_delta fragments are accumulated by the SDK
                        # helper; the assembled tool_use arrives in the final
                        # message below, so we deliberately ignore them here.
                final = s.get_final_message()

            parsed = self._parse(final, model)
            for tc in parsed.tool_calls:
                yield StreamChunk(type="tool_call", tool_call=tc, model=model)
            yield StreamChunk(
                type="done",
                usage=parsed.usage,
                finish_reason=parsed.finish_reason,
                model=model,
                raw=final,
            )

    # ------------------------------------------------------------------

    def count_tokens(self, messages, *, model=None, tools=None, **kwargs) -> int:
        model = self._resolve_model(model)
        system, msgs = self._split_system(messages)
        kw: dict[str, Any] = {}
        if system:
            kw["system"] = system
        if tools:
            kw["tools"] = self._build_tools(tools)
        with _errors(self.name, model):
            resp = self.client.messages.count_tokens(
                model=model, messages=self._build_messages(msgs), **kw
            )
        return resp.input_tokens

    async def achat(
        self,
        messages: Iterable[Union[Message, dict]],
        *,
        model: Optional[str] = None,
        tools: Optional[list[ToolDef]] = None,
        params: Optional[GenParams] = None,
        **kwargs: Any,
    ) -> ChatResponse:
        model, wire, kw = self._prepare(messages, model, tools, params, kwargs)
        with _errors(self.name, model):
            resp = await self.aclient.messages.create(model=model, messages=wire, **kw)
        return self._parse(resp, model)

    async def astream(self, messages, **kw):  # type: ignore[override]
        model, wire, params_kw = self._prepare(
            messages, kw.pop("model", None), kw.pop("tools", None),
            kw.pop("params", None), kw,
        )
        with _errors(self.name, model):
            async with self.aclient.messages.stream(
                model=model, messages=wire, **params_kw
            ) as s:
                async for event in s:
                    if getattr(event, "type", "") == "content_block_delta":
                        d = event.delta
                        if getattr(d, "type", "") == "text_delta":
                            yield StreamChunk(type="text", text=d.text, model=model)
                        elif getattr(d, "type", "") == "thinking_delta":
                            yield StreamChunk(type="thinking", text=d.thinking, model=model)
                final = await s.get_final_message()
            parsed = self._parse(final, model)
            for tc in parsed.tool_calls:
                yield StreamChunk(type="tool_call", tool_call=tc, model=model)
            yield StreamChunk(
                type="done", usage=parsed.usage,
                finish_reason=parsed.finish_reason, model=model,
            )


# --------------------------------------------------------------------------


_FINISH = {
    "end_turn": "stop",
    "stop_sequence": "stop",
    "max_tokens": "length",
    "tool_use": "tool_calls",
    "pause_turn": "pause",
    "refusal": "content_filter",
    "model_context_window_exceeded": "length",
}


def _iso_to_epoch(s: str) -> Optional[int]:
    from datetime import datetime

    try:
        return int(datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp())
    except (ValueError, AttributeError):
        return None


class _errors:
    def __init__(self, provider: str, model: str = "") -> None:
        self.provider, self.model = provider, model

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc is None or isinstance(exc, LLMError):
            return False
        try:
            import anthropic
        except ImportError:  # pragma: no cover
            return False

        ctx: dict[str, Any] = {
            "provider": self.provider, "model": self.model, "raw": exc,
        }
        status = getattr(exc, "status_code", None)
        if status:
            ctx["status_code"] = status
        rid = getattr(exc, "request_id", None) or getattr(exc, "_request_id", None)
        if rid:
            ctx["request_id"] = rid
        msg = str(exc)

        if isinstance(exc, anthropic.APITimeoutError):
            raise TimeoutError_(msg, **ctx) from exc
        if isinstance(exc, anthropic.APIConnectionError):
            raise ConnectionError_(msg, **ctx) from exc
        if isinstance(exc, anthropic.AuthenticationError | anthropic.PermissionDeniedError):
            raise AuthError(msg, **ctx) from exc
        if isinstance(exc, anthropic.NotFoundError):
            raise NotFoundError(msg, **ctx) from exc
        if isinstance(exc, anthropic.RateLimitError):
            raise RateLimitError(msg, **ctx) from exc
        if isinstance(exc, anthropic.BadRequestError):
            low = msg.lower()
            if "context" in low or "too long" in low or "prompt is too long" in low:
                raise ContextLengthError(msg, **ctx) from exc
            raise InvalidRequestError(msg, **ctx) from exc
        if status == 529:
            raise OverloadedError(msg, **ctx) from exc
        if isinstance(exc, anthropic.InternalServerError):
            raise ServerError(msg, **ctx) from exc
        if isinstance(exc, ValueError) and "10 minutes" in msg:
            # The SDK refuses long non-streaming requests. Actionable message.
            raise InvalidRequestError(
                "Request is long enough that the SDK requires streaming. "
                "Use provider.stream(...) or lower max_tokens.",
                **ctx,
            ) from exc
        if isinstance(exc, anthropic.APIError):
            raise LLMError(msg, **ctx) from exc
        return False
