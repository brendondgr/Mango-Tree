"""The provider registry: built-in kinds, configured endpoints, and discovery.

Two sources feed it, in this order of precedence:

1. ``config/models.yaml`` — endpoints declared in the repo. Keys are named, not
   embedded: a provider says ``api_key_env: ANTHROPIC_API_KEY`` and the value is
   read from the environment at call time.
2. The ``LlmProvider`` table — endpoints the owner added through the settings
   UI, which is the path that lets them add a provider without touching a file.

Everything downstream (the API views, the agent loop) talks to this module
rather than to a provider SDK, so adding a fifth backend is an adapter plus a
row here, not a change to the agent.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

from utils.shared.llm.kit.config import ProviderConfig, build_config
from utils.shared.llm.kit.discovery import ModelCache, safe_discover, sort_models
from utils.shared.llm.kit.providers import build_provider

#: Adapter kinds this platform exposes. Anything llmkit supports can be added
#: here; these are the ones with a tested path in this repo.
KNOWN_KINDS: dict[str, str] = {
    "openai_compatible": "OpenAI-compatible server",
    "vllm": "vLLM",
    "llamacpp": "llama.cpp",
    "ollama": "Ollama",
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "gemini": "Google Gemini",
    "deepseek": "DeepSeek",
}

#: Kinds that talk to a hosted API and therefore require a key.
HOSTED_KINDS = {"openai", "anthropic", "gemini", "deepseek"}

# Discovery is a network round-trip, so it is cached. Failures are cached too,
# for much less time — without that, a settings page listing four providers with
# one box switched off re-times-out on every render.
#
# Two caches because the TTL belongs to the cache, not the call: a local
# catalogue changes whenever the owner runs `ollama pull`, while a hosted one
# changes monthly.
_LOCAL_CACHE = ModelCache(ttl=60.0, error_ttl=15.0)
_HOSTED_CACHE = ModelCache(ttl=300.0, error_ttl=15.0)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[4]


@dataclass(frozen=True)
class ProviderEntry:
    """A configured endpoint, from either source."""

    slug: str
    label: str
    kind: str
    base_url: str
    api_key: str
    default_model: str
    params: dict[str, Any]
    enabled: bool
    connect_timeout: float
    timeout: float
    source: str  # "config" | "owner"
    key_hint: str = ""

    @property
    def has_key(self) -> bool:
        return bool(self.api_key)

    @property
    def needs_key(self) -> bool:
        return self.kind in HOSTED_KINDS

    def to_dict(self) -> dict[str, Any]:
        """Public shape. The key itself is never included."""
        return {
            "slug": self.slug,
            "label": self.label,
            "kind": self.kind,
            "kind_label": KNOWN_KINDS.get(self.kind, self.kind),
            "base_url": self.base_url,
            "default_model": self.default_model,
            "params": self.params,
            "enabled": self.enabled,
            "connect_timeout": self.connect_timeout,
            "timeout": self.timeout,
            "source": self.source,
            "has_key": self.has_key,
            "needs_key": self.needs_key,
            "key_hint": self.key_hint,
            # An editable provider is one the owner created; config-declared
            # ones are read-only from the UI, since the file is the source.
            "editable": self.source == "owner",
        }


def _yaml_providers() -> list[ProviderEntry]:
    path = _repo_root() / "config" / "models.yaml"
    if not path.is_file():
        return []
    with path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle) or {}

    entries: list[ProviderEntry] = []
    for slug, raw in (data.get("providers") or {}).items():
        raw = raw or {}
        # `type` is the historical spelling in this file; `kind` matches llmkit.
        kind = raw.get("kind") or raw.get("type") or "openai_compatible"
        key_env = raw.get("api_key_env") or ""
        api_key = os.environ.get(key_env, "") if key_env else ""
        entries.append(
            ProviderEntry(
                slug=slug,
                label=raw.get("label") or slug.replace("-", " ").replace("_", " ").title(),
                kind=kind,
                base_url=raw.get("base_url") or "",
                api_key=api_key,
                default_model=raw.get("default_model") or raw.get("model") or "",
                params=raw.get("params") or {},
                enabled=bool(raw.get("enabled", True)),
                connect_timeout=float(raw.get("connect_timeout", 5.0)),
                timeout=float(raw.get("timeout", 180.0)),
                source="config",
                key_hint=f"env:{key_env}" if key_env and api_key else "",
            )
        )
    return entries


def _owner_providers() -> list[ProviderEntry]:
    # Imported here so this module can be used before Django's app registry is
    # ready (the probe script, for one).
    from utils.shared.llm.models import LlmProvider

    entries: list[ProviderEntry] = []
    for row in LlmProvider.objects.all():
        api_key = row.api_key
        if not api_key and row.api_key_env:
            api_key = os.environ.get(row.api_key_env, "")
        entries.append(
            ProviderEntry(
                slug=row.slug,
                label=row.label,
                kind=row.kind,
                base_url=row.base_url,
                api_key=api_key,
                default_model=row.default_model,
                params=row.params or {},
                enabled=row.enabled,
                connect_timeout=row.connect_timeout,
                timeout=row.timeout,
                source="owner",
                key_hint=row.key_hint(),
            )
        )
    return entries


def list_providers(include_disabled: bool = True) -> list[ProviderEntry]:
    """Every configured endpoint. Owner rows win a slug collision, because the
    UI is the more recently expressed intent."""
    by_slug: dict[str, ProviderEntry] = {e.slug: e for e in _yaml_providers()}
    for entry in _owner_providers():
        by_slug[entry.slug] = entry
    entries = sorted(by_slug.values(), key=lambda e: (e.source != "config", e.label))
    return entries if include_disabled else [e for e in entries if e.enabled]


def get_provider(slug: str) -> ProviderEntry | None:
    return next((e for e in list_providers() if e.slug == slug), None)


def default_provider_slug() -> str | None:
    """The provider a fresh session starts on."""
    path = _repo_root() / "config" / "models.yaml"
    declared = None
    if path.is_file():
        with path.open(encoding="utf-8") as handle:
            declared = (yaml.safe_load(handle) or {}).get("default_provider")

    available = list_providers(include_disabled=False)
    if declared and any(e.slug == declared for e in available):
        return declared
    return available[0].slug if available else None


def _to_kit_config(entry: ProviderEntry) -> ProviderConfig:
    """Translate a registry entry into the vendored layer's config shape."""
    return build_config(
        entry.slug,
        entry.kind,
        label=entry.label,
        base_url=entry.base_url or None,
        api_key=entry.api_key or None,
        default_model=entry.default_model or None,
        params=entry.params or {},
        enabled=entry.enabled,
        connect_timeout=entry.connect_timeout,
        timeout=entry.timeout,
    )


def build(entry: ProviderEntry):
    """Instantiate the adapter for an entry."""
    return build_provider(_to_kit_config(entry))


def discover_models(entry: ProviderEntry, refresh: bool = False) -> dict[str, Any]:
    """List what a provider actually serves.

    Never raises. An unreachable local server is a normal state, not an
    exception — the settings page must be able to say "that box is off" without
    the request failing.
    """
    cache = _HOSTED_CACHE if entry.kind in HOSTED_KINDS else _LOCAL_CACHE
    result = safe_discover(build(entry), cache=cache, force=refresh)

    if not result.ok:
        return {
            "ok": False,
            "provider": entry.slug,
            "error": result.error,
            "cached": result.cached,
            "models": [],
        }

    models = sort_models(result.models)
    return {
        "ok": True,
        "provider": entry.slug,
        "cached": result.cached,
        "models": [
            {
                "id": model.id,
                "label": model.display_name or model.id,
                "context_window": model.context_window,
                "max_output_tokens": model.max_output_tokens,
                "capabilities": sorted(c.value for c in (model.capabilities or set())),
                # Whether each capability was reported by the server, derived
                # from a second endpoint, guessed from the id, or read from
                # config. A UI that greys out a control based on a *guess* is
                # worse than one that lets the user try.
                "capability_source": (model.meta or {}).get("capability_source"),
                "family": model.family,
            }
            for model in models
        ],
    }
