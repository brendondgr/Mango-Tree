"""The registry: the single object an application holds.

    from llmkit import Registry

    reg = Registry.from_yaml("providers.yaml")

    reg.provider_options()              # -> dropdown 1
    reg.model_options("local-vllm")     # -> dropdown 2, populated on selection
    reg.chat("local-vllm", "qwen3:8b", messages)

Everything a settings UI needs is here, in a form that is JSON-serializable so
the same code works behind FastAPI, inside a Qt app, or in a notebook.
"""

from __future__ import annotations

import threading
from pathlib import Path
from typing import Any, Iterable, Iterator, Optional, Union

from .base import Provider
from .config import ProviderConfig, build_config, load_configs
from .discovery import (
    DiscoveryResult,
    ModelCache,
    discover_all,
    group_by_family,
    safe_discover,
)
from .errors import ConfigError, NotFoundError
from .params import GenParams
from .providers import build_provider
from .retry import CircuitBreaker, RetryPolicy, first_working, with_retry
from .types import (
    Capability,
    ChatResponse,
    Message,
    ModelInfo,
    StreamChunk,
    ToolDef,
)


class Registry:
    """Holds provider configs, live adapters, and a discovery cache."""

    def __init__(
        self,
        configs: Optional[Iterable[ProviderConfig]] = None,
        *,
        cache_ttl: float = 300.0,
        retry: Optional[RetryPolicy] = None,
    ) -> None:
        self._configs: dict[str, ProviderConfig] = {}
        self._providers: dict[str, Provider] = {}
        self._breakers: dict[str, CircuitBreaker] = {}
        self._lock = threading.RLock()
        self.cache = ModelCache(ttl=cache_ttl)
        self.retry = retry or RetryPolicy()
        for cfg in configs or []:
            self.add(cfg)

    # ------------------------------------------------------------------
    # Construction
    # ------------------------------------------------------------------

    @classmethod
    def from_yaml(cls, path: Union[str, Path, None] = None, **kw: Any) -> "Registry":
        return cls(load_configs(path).values(), **kw)

    @classmethod
    def from_env(cls, **kw: Any) -> "Registry":
        """Build a registry from whatever credentials are present.

        Convenient for scripts and notebooks: any provider whose API key env
        var is set gets registered, plus the three local servers (which are
        cheap to include because discovery failures are cached and non-fatal).
        """
        import os

        cfgs: list[ProviderConfig] = []
        if os.environ.get("OPENAI_API_KEY"):
            cfgs.append(build_config("openai", "openai"))
        if os.environ.get("ANTHROPIC_API_KEY"):
            cfgs.append(build_config("anthropic", "anthropic"))
        if os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
            cfgs.append(build_config("gemini", "gemini"))
        if os.environ.get("DEEPSEEK_API_KEY"):
            cfgs.append(build_config("deepseek", "deepseek"))
        for name, kind in (("ollama", "ollama"), ("vllm", "vllm"), ("llamacpp", "llamacpp")):
            cfgs.append(build_config(name, kind))
        return cls(cfgs, **kw)

    def add(self, config: ProviderConfig) -> ProviderConfig:
        with self._lock:
            self._configs[config.name] = config
            self._providers.pop(config.name, None)
            self._breakers.setdefault(config.name, CircuitBreaker())
            self.cache.invalidate(config.name)
        return config

    def add_endpoint(self, name: str, kind: str, **kw: Any) -> ProviderConfig:
        """Register a provider without touching a config file."""
        return self.add(build_config(name, kind, **kw))

    def remove(self, name: str) -> None:
        with self._lock:
            self._configs.pop(name, None)
            self._providers.pop(name, None)
            self.cache.invalidate(name)

    # ------------------------------------------------------------------
    # Access
    # ------------------------------------------------------------------

    def config(self, name: str) -> ProviderConfig:
        try:
            return self._configs[name]
        except KeyError:
            raise NotFoundError(
                f"No provider registered as {name!r}. "
                f"Known: {', '.join(sorted(self._configs)) or '(none)'}"
            ) from None

    def provider(self, name: str) -> Provider:
        with self._lock:
            if name not in self._providers:
                self._providers[name] = build_provider(self.config(name))
            return self._providers[name]

    def __getitem__(self, name: str) -> Provider:
        return self.provider(name)

    def __contains__(self, name: str) -> bool:
        return name in self._configs

    def __iter__(self) -> Iterator[str]:
        return iter(self._configs)

    def names(self, *, enabled_only: bool = True) -> list[str]:
        return [
            n for n, c in self._configs.items() if c.enabled or not enabled_only
        ]

    # ------------------------------------------------------------------
    # Dropdown 1: providers
    # ------------------------------------------------------------------

    def provider_options(self, *, enabled_only: bool = True) -> list[dict[str, Any]]:
        """Rows for the service selector.

        Deliberately does NOT contact any server — this must render instantly.
        Liveness belongs in `model_options`, which runs on selection.
        """
        return [
            {
                "value": name,
                "label": cfg.label,
                "kind": cfg.kind,
                "base_url": cfg.base_url,
                "default_model": cfg.default_model,
                "is_local": cfg.kind in ("ollama", "vllm", "llamacpp"),
                "configured": bool(cfg.api_key) or cfg.kind in ("ollama", "vllm", "llamacpp"),
            }
            for name, cfg in self._configs.items()
            if cfg.enabled or not enabled_only
        ]

    # ------------------------------------------------------------------
    # Dropdown 2: models — the core flow
    # ------------------------------------------------------------------

    def discover(self, name: str, *, force: bool = False) -> DiscoveryResult:
        """Query one provider for its models. Never raises."""
        return safe_discover(self.provider(name), self.cache, force=force)

    def discover_all(self, *, force: bool = False, timeout: float = 20.0):
        """Query every enabled provider concurrently. Never raises."""
        return discover_all(
            [self.provider(n) for n in self.names()],
            self.cache,
            force=force,
            timeout=timeout,
        )

    def models(
        self,
        name: str,
        *,
        force: bool = False,
        capability: Optional[Capability] = None,
    ) -> list[ModelInfo]:
        result = self.discover(name, force=force)
        models = result.models
        if capability:
            models = [m for m in models if capability in m.capabilities]
        return models

    def model_options(
        self,
        name: str,
        *,
        force: bool = False,
        capability: Optional[Capability] = None,
        grouped: bool = False,
    ) -> dict[str, Any]:
        """Everything a model dropdown needs, in one JSON-safe payload.

        This is the function to wire to a provider-selection event:

            {
              "provider": "local-vllm",
              "ok": true,
              "error": null,
              "cached": false,
              "elapsed_ms": 41.2,
              "default": "Qwen/Qwen3-8B",
              "options": [{"value": ..., "label": ..., "capabilities": [...]}],
              "groups": {"qwen": [...]}          # when grouped=True
            }

        `ok: false` with a populated `error` is a normal outcome (the laptop
        running Ollama is asleep). Render the message next to a disabled
        dropdown rather than throwing.
        """
        result = self.discover(name, force=force)
        models = result.models
        if capability:
            models = [m for m in models if capability in m.capabilities]

        cfg = self.config(name)
        default = cfg.default_model
        if default and default not in {m.id for m in models}:
            default = models[0].id if models else None
        elif not default and models:
            default = models[0].id

        payload: dict[str, Any] = {
            "provider": name,
            "label": cfg.label,
            "ok": result.ok,
            "error": result.error,
            "cached": result.cached,
            "elapsed_ms": round(result.elapsed_ms, 1),
            "default": default,
            "options": [
                {
                    "value": m.id,
                    "label": m.label(),
                    "capabilities": sorted(c.value for c in m.capabilities),
                    "context_window": m.context_window,
                    "family": m.family,
                    "loaded": m.meta.get("loaded"),
                }
                for m in models
            ],
        }
        if grouped:
            payload["groups"] = {
                fam: [m.id for m in group]
                for fam, group in group_by_family(models).items()
            }
        return payload

    def find_model(self, model_id: str) -> list[tuple[str, ModelInfo]]:
        """Which registered providers can serve this model id?

        Useful for building a fallback chain automatically, and for resolving
        a saved setting after someone repoints a base_url.
        """
        hits = []
        for name in self.names():
            for m in self.discover(name).models:
                if m.id == model_id:
                    hits.append((name, m))
        return hits

    def refresh(self, name: Optional[str] = None) -> None:
        """Drop cached discovery results (for a UI 'refresh' button)."""
        self.cache.invalidate(name)

    # ------------------------------------------------------------------
    # Generation
    # ------------------------------------------------------------------

    def chat(
        self,
        provider: str,
        messages: Iterable[Union[Message, dict]],
        *,
        model: Optional[str] = None,
        tools: Optional[list[ToolDef]] = None,
        params: Optional[GenParams] = None,
        retry: bool = True,
        **kwargs: Any,
    ) -> ChatResponse:
        p = self.provider(provider)
        breaker = self._breakers.setdefault(provider, CircuitBreaker())

        def call() -> ChatResponse:
            return breaker.call(
                lambda: p.chat(
                    messages, model=model, tools=tools, params=params, **kwargs
                )
            )

        return with_retry(call, self.retry) if retry else call()

    def stream(
        self,
        provider: str,
        messages: Iterable[Union[Message, dict]],
        *,
        model: Optional[str] = None,
        tools: Optional[list[ToolDef]] = None,
        params: Optional[GenParams] = None,
        **kwargs: Any,
    ) -> Iterator[StreamChunk]:
        # Streams are deliberately not retried: partial output has already
        # reached the caller, and replaying it duplicates text on screen.
        yield from self.provider(provider).stream(
            messages, model=model, tools=tools, params=params, **kwargs
        )

    async def achat(
        self, provider: str, messages: Iterable[Union[Message, dict]], **kw: Any
    ) -> ChatResponse:
        return await self.provider(provider).achat(messages, **kw)

    def chat_with_fallback(
        self,
        chain: list[tuple[str, Optional[str]]],
        messages: Iterable[Union[Message, dict]],
        *,
        on_fallback: Optional[Any] = None,
        **kwargs: Any,
    ) -> ChatResponse:
        """Try (provider, model) pairs in order until one answers.

            reg.chat_with_fallback(
                [("local-vllm", "Qwen/Qwen3-8B"), ("anthropic", "claude-sonnet-5")],
                messages,
            )

        Falls through on connection errors, rate limits, overload, and
        "model not found" — i.e. exactly the cases where a different backend
        would help. A malformed request raises immediately instead, because
        every backend would reject it identically.
        """
        candidates = [
            (
                f"{prov}/{mod or 'default'}",
                (lambda pv=prov, md=mod: self.chat(
                    pv, messages, model=md, retry=False, **kwargs
                )),
            )
            for prov, mod in chain
        ]
        return first_working(candidates, policy=self.retry, on_fallback=on_fallback)

    # ------------------------------------------------------------------

    def health(self) -> dict[str, bool]:
        results: dict[str, bool] = {}
        for name in self.names():
            try:
                results[name] = self.provider(name).health()
            except Exception:
                results[name] = False
        return results

    def describe(self) -> list[dict[str, Any]]:
        """Redacted config dump — safe to log or return from an endpoint."""
        return [c.redacted() for c in self._configs.values()]

    def __repr__(self) -> str:
        return f"<Registry providers={sorted(self._configs)}>"
