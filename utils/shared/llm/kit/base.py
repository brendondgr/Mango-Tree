"""The Provider contract every adapter implements."""

from __future__ import annotations

import abc
import re
from typing import Any, AsyncIterator, Iterable, Iterator, Optional, Union

from .config import ProviderConfig
from .errors import CapabilityError
from .params import GenParams
from .types import (
    ChatResponse,
    Message,
    ModelInfo,
    StreamChunk,
    ToolDef,
    normalize_messages,
)


class Provider(abc.ABC):
    """Base class for every backend adapter.

    Only `list_models` and `chat` are strictly required. `stream` falls back to
    a single-chunk emulation, and the rest raise `CapabilityError` so callers
    get a clear message rather than an AttributeError.

    Async methods default to running the sync implementation in a thread, so a
    new adapter is useful the moment its sync path works. Adapters whose SDK
    has a real async client (all of OpenAI/Anthropic/Gemini do) should override
    them for genuine concurrency.
    """

    kind: str = "base"

    def __init__(self, config: ProviderConfig) -> None:
        self.config = config
        self.name = config.name

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    @abc.abstractmethod
    def list_models(self) -> list[ModelInfo]:
        """Query the live endpoint and return every model it will serve.

        Adapters must not raise on an empty catalogue — an empty list is a
        legitimate answer (an Ollama host with nothing pulled). They *should*
        raise `ConnectionError_` when the host is unreachable, so the UI can
        distinguish "no models" from "server is down".
        """

    def health(self) -> bool:
        """Cheap liveness probe. Default: can we list models?"""
        try:
            self.list_models()
            return True
        except Exception:
            return False

    def filter_models(self, models: list[ModelInfo]) -> list[ModelInfo]:
        """Apply allow/deny regexes and metadata overrides from config."""
        cfg = self.config
        out = models
        if cfg.model_allow:
            pats = [re.compile(p) for p in cfg.model_allow]
            out = [m for m in out if any(p.search(m.id) for p in pats)]
        if cfg.model_deny:
            pats = [re.compile(p) for p in cfg.model_deny]
            out = [m for m in out if not any(p.search(m.id) for p in pats)]
        if cfg.model_overrides:
            out = [self._apply_override(m) for m in out]
        return out

    def _apply_override(self, model: ModelInfo) -> ModelInfo:
        import dataclasses

        patch: dict[str, Any] = {}
        for key, values in self.config.model_overrides.items():
            if key.startswith("re:"):
                if re.search(key[3:], model.id):
                    patch.update(values)
            elif key == model.id:
                patch.update(values)
        if not patch:
            return model
        caps = patch.pop("capabilities", None)
        meta = patch.pop("meta", None)
        fields = {f.name for f in dataclasses.fields(ModelInfo)}
        clean = {k: v for k, v in patch.items() if k in fields}
        if caps is not None:
            from .types import Capability

            clean["capabilities"] = frozenset(
                Capability(c) if not isinstance(c, Capability) else c for c in caps
            )
        if meta is not None:
            clean["meta"] = {**model.meta, **meta}
        return dataclasses.replace(model, **clean)

    # ------------------------------------------------------------------
    # Generation
    # ------------------------------------------------------------------

    @abc.abstractmethod
    def chat(
        self,
        messages: Iterable[Union[Message, dict]],
        *,
        model: Optional[str] = None,
        tools: Optional[list[ToolDef]] = None,
        params: Optional[GenParams] = None,
        **kwargs: Any,
    ) -> ChatResponse:
        """One non-streaming completion."""

    def stream(
        self,
        messages: Iterable[Union[Message, dict]],
        *,
        model: Optional[str] = None,
        tools: Optional[list[ToolDef]] = None,
        params: Optional[GenParams] = None,
        **kwargs: Any,
    ) -> Iterator[StreamChunk]:
        """Streaming completion. Default: emulate from the non-streaming call."""
        resp = self.chat(
            messages, model=model, tools=tools, params=params, **kwargs
        )
        if resp.text:
            yield StreamChunk(type="text", text=resp.text, model=resp.model)
        for tc in resp.tool_calls:
            yield StreamChunk(type="tool_call", tool_call=tc, model=resp.model)
        yield StreamChunk(
            type="done",
            usage=resp.usage,
            finish_reason=resp.finish_reason,
            model=resp.model,
            raw=resp.raw,
        )

    def embed(
        self, texts: list[str], *, model: Optional[str] = None, **kwargs: Any
    ) -> list[list[float]]:
        raise CapabilityError(
            f"{self.name} ({self.kind}) does not implement embeddings",
            provider=self.name,
        )

    def count_tokens(
        self,
        messages: Iterable[Union[Message, dict]],
        *,
        model: Optional[str] = None,
        **kwargs: Any,
    ) -> int:
        raise CapabilityError(
            f"{self.name} ({self.kind}) does not implement token counting",
            provider=self.name,
        )

    # ------------------------------------------------------------------
    # Async — thread-offload defaults
    # ------------------------------------------------------------------

    async def alist_models(self) -> list[ModelInfo]:
        import asyncio

        return await asyncio.to_thread(self.list_models)

    async def achat(self, messages: Iterable[Union[Message, dict]], **kw: Any) -> ChatResponse:
        import asyncio
        import functools

        return await asyncio.to_thread(functools.partial(self.chat, messages, **kw))

    async def astream(
        self, messages: Iterable[Union[Message, dict]], **kw: Any
    ) -> AsyncIterator[StreamChunk]:
        """Bridge the sync generator onto an executor thread.

        Correct but not free: it holds a worker thread for the stream's
        lifetime. Adapters with a native async client should override.
        """
        import asyncio

        queue: asyncio.Queue = asyncio.Queue(maxsize=64)
        loop = asyncio.get_running_loop()
        sentinel = object()

        def produce() -> None:
            try:
                for chunk in self.stream(messages, **kw):
                    asyncio.run_coroutine_threadsafe(queue.put(chunk), loop).result()
            except Exception as exc:  # surfaced to the consumer below
                asyncio.run_coroutine_threadsafe(queue.put(exc), loop).result()
            finally:
                asyncio.run_coroutine_threadsafe(queue.put(sentinel), loop).result()

        task = asyncio.get_running_loop().run_in_executor(None, produce)
        try:
            while True:
                item = await queue.get()
                if item is sentinel:
                    break
                if isinstance(item, Exception):
                    raise item
                yield item
        finally:
            await task

    # ------------------------------------------------------------------
    # Shared helpers
    # ------------------------------------------------------------------

    def _resolve_model(self, model: Optional[str]) -> str:
        m = model or self.config.default_model
        if not m:
            raise CapabilityError(
                f"No model specified and provider {self.name!r} has no "
                f"default_model configured.",
                provider=self.name,
            )
        return m

    def _params(self, params: Optional[GenParams], **overrides: Any) -> GenParams:
        base = params or self.config.params
        return base.merged(**overrides) if overrides else base

    @staticmethod
    def _split_system(
        messages: Iterable[Union[Message, dict]]
    ) -> tuple[Optional[str], list[Message]]:
        """Lift `system` turns out of the message list.

        Anthropic and Gemini have no system role — the text belongs in a
        top-level parameter. Multiple system turns are concatenated in order.
        """
        msgs = normalize_messages(messages)
        system_bits = [m.text() for m in msgs if m.role == "system"]
        rest = [m for m in msgs if m.role != "system"]
        system = "\n\n".join(b for b in system_bits if b) or None
        return system, rest

    def __repr__(self) -> str:
        return f"<{type(self).__name__} name={self.name!r} base_url={self.config.base_url!r}>"
