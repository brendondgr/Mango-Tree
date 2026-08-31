"""CRUD for owner-defined providers, plus connection testing.

Business logic lives here; the DRF views are thin callers, per the repo's
layering rule. Nothing in this module ever returns an API key.
"""

from __future__ import annotations

import re
from typing import Any

from utils.shared.llm.kit.errors import LLMError
from utils.shared.llm.kit.params import GenParams
from utils.shared.llm.kit.types import Message
from utils.shared.llm.models import LlmProvider
from utils.shared.llm.services import registry

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")


class ProviderError(Exception):
    """Raised for a request the caller can fix. Carries a machine-readable
    ``kind`` so the view can pick a status code without string-matching."""

    def __init__(self, message: str, kind: str = "validation_error", field: str | None = None):
        super().__init__(message)
        self.message = message
        self.kind = kind
        self.field = field


def _clean_slug(raw: Any) -> str:
    # Case is normalised rather than rejected — a slug is an identifier, and
    # "MyBox" meaning "mybox" is the obvious reading.
    slug = (raw or "").strip().lower() if isinstance(raw, str) else ""
    if not SLUG_RE.match(slug):
        raise ProviderError(
            "Id must be lowercase letters, numbers or hyphens, and start with a letter or number.",
            field="slug",
        )
    return slug


def _clean_kind(raw: Any) -> str:
    kind = (raw or "").strip() if isinstance(raw, str) else ""
    if kind not in registry.KNOWN_KINDS:
        raise ProviderError(
            f"Unknown provider kind '{kind}'. Expected one of: "
            + ", ".join(sorted(registry.KNOWN_KINDS)),
            field="kind",
        )
    return kind


def _clean_timeouts(payload: dict) -> dict[str, float]:
    out: dict[str, float] = {}
    for field, minimum in (("connect_timeout", 0.5), ("timeout", 1.0)):
        if field not in payload:
            continue
        try:
            value = float(payload[field])
        except (TypeError, ValueError):
            raise ProviderError(f"{field} must be a number.", field=field) from None
        if value < minimum:
            raise ProviderError(f"{field} must be at least {minimum}s.", field=field)
        out[field] = value
    return out


def _requires_base_url(kind: str) -> bool:
    """Hosted providers know their own endpoint; local ones must be told."""
    return kind not in registry.HOSTED_KINDS


def create_provider(payload: dict) -> LlmProvider:
    slug = _clean_slug(payload.get("slug"))
    if LlmProvider.objects.filter(slug=slug).exists():
        raise ProviderError("A provider with that id already exists.", "conflict", "slug")
    if any(entry.slug == slug for entry in registry.list_providers()):
        raise ProviderError(
            "That id is already declared in config/models.yaml.", "conflict", "slug"
        )

    kind = _clean_kind(payload.get("kind"))
    base_url = (payload.get("base_url") or "").strip()
    if _requires_base_url(kind) and not base_url:
        raise ProviderError("A base URL is required for this kind.", field="base_url")

    label = (payload.get("label") or "").strip() or slug.replace("-", " ").title()

    provider = LlmProvider(
        slug=slug,
        label=label,
        kind=kind,
        base_url=base_url,
        api_key=(payload.get("api_key") or "").strip(),
        api_key_env=(payload.get("api_key_env") or "").strip(),
        default_model=(payload.get("default_model") or "").strip(),
        params=payload.get("params") or {},
        enabled=bool(payload.get("enabled", True)),
        **_clean_timeouts(payload),
    )
    provider.save()
    return provider


def update_provider(slug: str, payload: dict) -> LlmProvider:
    try:
        provider = LlmProvider.objects.get(slug=slug)
    except LlmProvider.DoesNotExist:
        raise ProviderError("No such provider.", "not_found", "slug") from None

    if "kind" in payload:
        provider.kind = _clean_kind(payload["kind"])
    if "label" in payload:
        provider.label = (payload["label"] or "").strip() or provider.label
    if "base_url" in payload:
        provider.base_url = (payload["base_url"] or "").strip()
    if "default_model" in payload:
        provider.default_model = (payload["default_model"] or "").strip()
    if "params" in payload:
        provider.params = payload["params"] or {}
    if "enabled" in payload:
        provider.enabled = bool(payload["enabled"])
    if "api_key_env" in payload:
        provider.api_key_env = (payload["api_key_env"] or "").strip()

    # A key is only ever written, never read back, so an omitted field must
    # leave the stored key alone — otherwise saving any other setting would
    # silently wipe it. An explicit empty string clears it.
    if "api_key" in payload:
        provider.api_key = (payload["api_key"] or "").strip()

    for field, value in _clean_timeouts(payload).items():
        setattr(provider, field, value)

    if _requires_base_url(provider.kind) and not provider.base_url:
        raise ProviderError("A base URL is required for this kind.", field="base_url")

    provider.save()
    return provider


def delete_provider(slug: str) -> None:
    deleted, _ = LlmProvider.objects.filter(slug=slug).delete()
    if not deleted:
        raise ProviderError("No such provider.", "not_found", "slug")


def test_provider(slug: str, model: str | None = None) -> dict[str, Any]:
    """Reachability plus a real one-token round-trip.

    A models listing that succeeds proves the endpoint answers; it does not
    prove the key is accepted for *generation*, which is the failure the owner
    actually cares about. So this does both, and reports them separately.
    """
    entry = registry.get_provider(slug)
    if entry is None:
        raise ProviderError("No such provider.", "not_found", "slug")

    discovery = registry.discover_models(entry, refresh=True)
    result: dict[str, Any] = {
        "provider": slug,
        "reachable": discovery["ok"],
        "model_count": len(discovery.get("models") or []),
        "generated": False,
    }
    if not discovery["ok"]:
        # Already redacted by discover_models.
        result["error_kind"] = discovery.get("error_kind", "unreachable")
        result["error"] = discovery.get("error")
        return result

    chosen = (
        model
        or entry.default_model
        or (discovery["models"][0]["id"] if discovery["models"] else None)
    )
    if not chosen:
        result["error"] = "The provider is reachable but reports no models."
        return result

    result["model"] = chosen
    try:
        provider = registry.build(entry)
        response = provider.chat(
            [Message.user("Reply with the single word: ok")],
            model=chosen,
            params=GenParams(max_tokens=16),
        )
        result["generated"] = True
        result["sample"] = (response.text or "").strip()[:120]
        if response.usage:
            result["usage"] = {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            }
    except LLMError as exc:
        result["error_kind"] = type(exc).__name__
        result["error"] = registry.redact(exc, entry.api_key)
    except Exception as exc:  # pragma: no cover - adapter surprises
        result["error_kind"] = "UnexpectedError"
        result["error"] = registry.redact(exc, entry.api_key)

    return result
