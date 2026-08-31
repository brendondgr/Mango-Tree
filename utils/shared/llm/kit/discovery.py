"""Model discovery: cache, capability inference, and parallel fan-out.

This module is the answer to "populate the models dropdown when the user picks
a service". Its job is to make discovery *fast enough to run on a UI event* and
*never able to hang the UI*, across backends whose metadata quality ranges from
excellent (Ollama, Anthropic, Gemini) to a bare list of ids (OpenAI, DeepSeek).

Three rules the rest of the codebase depends on:

1. Discovery never raises into a UI path. `safe_discover` returns a result
   object carrying either models or an error string.
2. Results are cached with a TTL, so re-opening a settings panel is instant.
3. Missing metadata is filled in by inference, and inference is always marked
   as such in `ModelInfo.meta["capability_source"]`.
"""

from __future__ import annotations

import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any, Iterable, Optional

from .errors import LLMError
from .types import Capability, ModelInfo

# --------------------------------------------------------------------------
# Capability inference
# --------------------------------------------------------------------------

# Patterns are checked against a lowercased model id. Order does not matter;
# every match contributes. Kept deliberately conservative — a false positive
# ("this model does vision") produces a worse user experience than an unknown,
# because the UI will offer an attachment button that 400s.
_ID_PATTERNS: list[tuple[str, set[Capability]]] = [
    # --- embeddings / rerank ------------------------------------------------
    (r"embed|embedding|bge-|gte-|e5-|nomic-embed|mxbai", {Capability.EMBEDDING}),
    (r"rerank|reranker", {Capability.RERANK}),
    # --- reasoning ----------------------------------------------------------
    (r"^o[1-9](-|$)|^gpt-5|reason|thinking|-r1|deepseek-r|qwq|magistral",
     {Capability.THINKING}),
    # Claude line names beyond opus/sonnet/haiku are included speculatively —
    # they cost nothing if wrong, and inference is only a fallback here anyway
    # (Anthropic's /v1/models reports real capabilities, which the adapter
    # prefers). Same reasoning applies to any future name: add it, don't gate on it.
    (r"^claude-(opus|sonnet|haiku|fable|mythos)-[4-9]", {Capability.THINKING}),
    (r"gemini-(2\.5|[3-9])", {Capability.THINKING}),
    # --- vision -------------------------------------------------------------
    (r"vision|-vl(-|$)|llava|bakllava|moondream|pixtral|minicpm-v|internvl",
     {Capability.VISION}),
    (r"^gpt-4o|^gpt-4\.|^gpt-5|^o[34]", {Capability.VISION}),
    (r"^claude-", {Capability.VISION, Capability.PDF}),
    (r"^gemini-", {Capability.VISION, Capability.PDF, Capability.AUDIO_IN}),
    # --- audio --------------------------------------------------------------
    (r"audio|whisper|realtime|voxtral", {Capability.AUDIO_IN}),
    (r"^tts-|-tts", {Capability.AUDIO_OUT}),
    # --- code / FIM ---------------------------------------------------------
    (r"coder|codellama|starcoder|codestral|codegemma|qwen.*coder",
     {Capability.FIM}),
    # --- tools --------------------------------------------------------------
    (r"^gpt-[45]|^o[34]|^claude-|^gemini-|^deepseek-|instruct|-it(-|$)|"
     r"qwen[23]|hermes|firefunction|command-r|mistral|mixtral|llama-?3|granite",
     {Capability.TOOLS}),
]

_NON_CHAT = re.compile(
    r"embed|embedding|rerank|^tts-|^whisper|^dall-e|^gpt-image|^sora|"
    r"moderation|guard"
)


def infer_capabilities(model_id: str, kind: str = "") -> set[Capability]:
    """Guess capabilities from a model id.

    Used only where the provider tells us nothing (OpenAI, DeepSeek, vLLM,
    llama.cpp). Where real data exists — Ollama's `capabilities` array,
    Anthropic's `capabilities` object, Gemini's `supported_actions` — the
    adapter passes that through instead and never calls this.
    """
    mid = model_id.lower()
    caps: set[Capability] = set()
    for pattern, add in _ID_PATTERNS:
        if re.search(pattern, mid):
            caps |= add
    if _NON_CHAT.search(mid):
        caps.discard(Capability.TOOLS)
        caps.discard(Capability.VISION)
        caps.discard(Capability.THINKING)
    else:
        caps.add(Capability.CHAT)
        caps.add(Capability.STRUCTURED_OUTPUT)
    if not caps:
        caps.add(Capability.UNKNOWN)
    return caps


def infer_family(model_id: str) -> str:
    """Coarse grouping, useful for `optgroup` headings in a dropdown."""
    mid = model_id.lower()
    for pattern, family in [
        (r"^gpt-5", "gpt-5"),
        (r"^gpt-4", "gpt-4"),
        (r"^o[1-9]", "o-series"),
        (r"^claude-opus", "claude-opus"),
        (r"^claude-sonnet", "claude-sonnet"),
        (r"^claude-haiku", "claude-haiku"),
        (r"^claude-", "claude"),
        (r"^gemini-.*embed|^gemini-embedding", "gemini-embedding"),
        (r"^gemini-", "gemini"),
        (r"^deepseek", "deepseek"),
        (r"embed", "embeddings"),
        (r"llama", "llama"),
        (r"qwen", "qwen"),
        (r"mistral|mixtral", "mistral"),
        (r"gemma", "gemma"),
        (r"phi", "phi"),
    ]:
        if re.search(pattern, mid):
            return family
    return "other"


def sort_models(models: Iterable[ModelInfo]) -> list[ModelInfo]:
    """Stable, useful default ordering for a dropdown.

    Chat models first (that is what a picker is usually for), then by family,
    then newest-first inside a family where a creation timestamp exists,
    otherwise alphabetically.
    """
    def key(m: ModelInfo) -> tuple:
        is_chat = Capability.CHAT in m.capabilities
        # LoRA adapters sort after their base models: they are usually a
        # specialization, and one landing at position 0 would silently become
        # the preselected default.
        is_adapter = bool(m.meta.get("is_lora_adapter"))
        return (
            0 if is_chat else 1,
            1 if is_adapter else 0,
            m.family or infer_family(m.id),
            -(m.created or 0),
            m.id,
        )

    return sorted(models, key=key)


def group_by_family(models: Iterable[ModelInfo]) -> dict[str, list[ModelInfo]]:
    groups: dict[str, list[ModelInfo]] = {}
    for m in sort_models(models):
        groups.setdefault(m.family or infer_family(m.id), []).append(m)
    return groups


# --------------------------------------------------------------------------
# Caching
# --------------------------------------------------------------------------


@dataclass
class _Entry:
    models: list[ModelInfo]
    fetched_at: float
    error: Optional[str] = None


class ModelCache:
    """Thread-safe TTL cache of discovery results.

    Deliberately caches failures too (for a shorter window) so a settings page
    that lists eight providers, six of which are offline laptops, does not pay
    six connect timeouts on every render.
    """

    def __init__(self, ttl: float = 300.0, error_ttl: float = 15.0) -> None:
        self.ttl = ttl
        self.error_ttl = error_ttl
        self._data: dict[str, _Entry] = {}
        self._lock = threading.RLock()

    def get(self, key: str) -> Optional[_Entry]:
        with self._lock:
            entry = self._data.get(key)
            if entry is None:
                return None
            ttl = self.error_ttl if entry.error else self.ttl
            if ttl <= 0 or time.monotonic() - entry.fetched_at > ttl:
                self._data.pop(key, None)
                return None
            return entry

    def put(
        self, key: str, models: list[ModelInfo], error: Optional[str] = None
    ) -> None:
        with self._lock:
            self._data[key] = _Entry(models, time.monotonic(), error)

    def invalidate(self, key: Optional[str] = None) -> None:
        with self._lock:
            if key is None:
                self._data.clear()
            else:
                self._data.pop(key, None)


# --------------------------------------------------------------------------
# Discovery results
# --------------------------------------------------------------------------


@dataclass
class DiscoveryResult:
    """What a UI needs to render one provider's slice of a dropdown."""

    provider: str
    models: list[ModelInfo] = field(default_factory=list)
    error: Optional[str] = None
    cached: bool = False
    elapsed_ms: float = 0.0

    @property
    def ok(self) -> bool:
        return self.error is None

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "ok": self.ok,
            "error": self.error,
            "cached": self.cached,
            "elapsed_ms": round(self.elapsed_ms, 1),
            "models": [m.to_dict() for m in self.models],
        }


def safe_discover(
    provider: Any,
    cache: Optional[ModelCache] = None,
    *,
    force: bool = False,
) -> DiscoveryResult:
    """Discover models without ever raising.

    This is the function a UI event handler should call. It returns a result
    object with either `models` or a human-readable `error` suitable for
    display next to the dropdown ("Connection refused — is Ollama running?").
    """
    key = provider.name
    started = time.monotonic()

    if cache and not force:
        entry = cache.get(key)
        if entry is not None:
            return DiscoveryResult(
                provider=key,
                models=entry.models,
                error=entry.error,
                cached=True,
                elapsed_ms=0.0,
            )

    try:
        models = provider.filter_models(provider.list_models())
        models = sort_models(models)
        if not models and provider.config.fallback_models:
            models = [
                ModelInfo(
                    id=mid,
                    provider=key,
                    family=infer_family(mid),
                    capabilities=frozenset(infer_capabilities(mid, provider.kind)),
                    meta={"capability_source": "configured-fallback"},
                )
                for mid in provider.config.fallback_models
            ]
        if cache:
            cache.put(key, models)
        return DiscoveryResult(
            provider=key,
            models=models,
            elapsed_ms=(time.monotonic() - started) * 1000,
        )
    except LLMError as exc:
        msg = _friendly(exc)
    except Exception as exc:  # third-party SDKs raise plenty we don't wrap
        msg = f"{type(exc).__name__}: {exc}"

    fallback = [
        ModelInfo(
            id=mid,
            provider=key,
            family=infer_family(mid),
            capabilities=frozenset(infer_capabilities(mid, provider.kind)),
            meta={"capability_source": "configured-fallback"},
        )
        for mid in provider.config.fallback_models
    ]
    if cache:
        cache.put(key, fallback, error=msg)
    return DiscoveryResult(
        provider=key,
        models=fallback,
        error=msg,
        elapsed_ms=(time.monotonic() - started) * 1000,
    )


def _friendly(exc: LLMError) -> str:
    """Turn an exception into something worth showing a user."""
    from .errors import AuthError, ConnectionError_, NotFoundError, TimeoutError_

    if isinstance(exc, ConnectionError_):
        return f"Could not reach the server — is it running? ({exc.message})"
    if isinstance(exc, TimeoutError_):
        return "Timed out contacting the server."
    if isinstance(exc, AuthError):
        return "Authentication failed — check the API key."
    if isinstance(exc, NotFoundError):
        return "No model listing endpoint on this server."
    return str(exc)


def discover_all(
    providers: Iterable[Any],
    cache: Optional[ModelCache] = None,
    *,
    force: bool = False,
    max_workers: int = 8,
    timeout: float = 20.0,
) -> dict[str, DiscoveryResult]:
    """Query every provider concurrently.

    Use this to warm the cache at app start so the first click on the provider
    dropdown is instant. Providers that time out are reported as errors rather
    than blocking the others.
    """
    providers = list(providers)
    results: dict[str, DiscoveryResult] = {}
    if not providers:
        return results

    with ThreadPoolExecutor(max_workers=min(max_workers, len(providers))) as pool:
        futures = {
            pool.submit(safe_discover, p, cache, force=force): p for p in providers
        }
        try:
            for fut in as_completed(futures, timeout=timeout):
                p = futures[fut]
                try:
                    results[p.name] = fut.result()
                except Exception as exc:  # pragma: no cover
                    results[p.name] = DiscoveryResult(
                        provider=p.name, error=f"{type(exc).__name__}: {exc}"
                    )
        except TimeoutError:
            pass

    for p in providers:
        results.setdefault(
            p.name,
            DiscoveryResult(provider=p.name, error="Discovery timed out"),
        )
    return results
