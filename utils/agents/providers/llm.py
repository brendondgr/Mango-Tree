"""The coordinator's seam onto the provider abstraction.

The agent used to POST to an OpenAI-compatible endpoint itself, with the base
URL, model and **API key** arriving from the browser on every turn. It now asks
this module for a provider resolved *server-side* through
``utils.shared.llm.services.registry``, and consumes the normalized
``StreamChunk`` events the vendored layer emits — so an OpenAI-compatible
server, Anthropic, Gemini and Ollama all run through one code path and every
wire-format difference stays inside the adapter.

Two rules this module exists to enforce:

1. **A per-request override names a provider, never a secret.** The turn payload
   carries ``{"provider": slug, "model": id}``; the key is read from the registry
   entry (``config/models.yaml`` or the owner table) on the server. The old
   ``{base_url, model, api_key}`` shape still resolves — see
   :func:`_inline_provider` — so an un-updated client keeps working, but it is
   deprecated and nothing new should send it.
2. **No key ever reaches a message.** Provider failures are re-raised as
   :class:`LLMProviderError` with the upstream text redacted, and an
   authentication failure is reported with a fixed message rather than the
   provider's own body — several servers echo the offending key into it.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any, Iterable, Iterator, Optional, Union

from utils.shared.llm.kit.config import build_config
from utils.shared.llm.kit.errors import (
    AuthError,
    CapabilityError,
    ConfigError,
    ConnectionError_,
    ContentFilterError,
    ContextLengthError,
    InvalidRequestError,
    LLMError,
    NotFoundError,
    OverloadedError,
    RateLimitError,
    ServerError,
    TimeoutError_,
)
from utils.shared.llm.kit.params import GenParams
from utils.shared.llm.kit.providers import build_provider
from utils.shared.llm.kit.types import Message, StreamChunk, ToolDef

#: Last-resort fallbacks for a deployment that configures the agent purely from
#: the environment. The registry (``config/models.yaml`` plus the owner table) is
#: the source of truth; these only apply when it has nothing to offer. Empty
#: means "unset" — a blank model is an error the user can fix in the UI, not a
#: placeholder to send to a server.
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "").strip().rstrip("/")
LLM_MODEL = os.getenv("LLM_MODEL", "").strip()
LLM_API_KEY = os.getenv("LLM_API_KEY", "").strip()


class LLMProviderError(Exception):
    """A provider call failed, in a way worth showing the user.

    ``code`` is a stable machine-readable slug (``auth_error``, ``unreachable``,
    ``no_model``, ...) so the frontend can render the right affordance — a link
    to Settings for a bad key, a retry for an overloaded service. It is *never*
    swallowed into a fabricated answer.
    """

    def __init__(
        self,
        message: str,
        *,
        code: str = "provider_error",
        provider: str = "",
        model: str = "",
        status_code: Optional[int] = None,
        retryable: bool = False,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.provider = provider
        self.model = model
        self.status_code = status_code
        self.retryable = retryable

    def to_event(self) -> dict[str, Any]:
        """The payload for an ``error`` SSE event. Contains no secret."""
        return {
            "message": self.message,
            "code": self.code,
            "provider": self.provider,
            "model": self.model,
            "status_code": self.status_code,
            "retryable": self.retryable,
        }


@dataclass(frozen=True)
class ResolvedProvider:
    """One turn's target: which endpoint, which model, which adapter."""

    slug: str
    label: str
    model: str
    source: str          # "config" | "owner" | "inline"
    adapter: Any

    def __repr__(self) -> str:  # never render the adapter's config (it holds a key)
        return (
            f"<ResolvedProvider slug={self.slug!r} model={self.model!r} "
            f"source={self.source!r}>"
        )


# --- redaction ----------------------------------------------------------------

# `https://user:token@host` — a key can hide in a base URL as well as a header.
_URL_CREDENTIALS = re.compile(r"(//)[^/\s@]+@")


def _redact(text: Any, secrets: Iterable[str] = ()) -> str:
    out = str(text)
    for secret in secrets:
        if secret and len(secret) >= 6:
            out = out.replace(secret, "***")
    return _URL_CREDENTIALS.sub(r"\1***@", out)


def _secrets_for(target: "ResolvedProvider") -> tuple[str, ...]:
    key = getattr(getattr(target.adapter, "config", None), "api_key", "") or ""
    return (key, LLM_API_KEY)


# --- resolution ---------------------------------------------------------------

def _registry():
    """Imported lazily: this module is imported before Django's apps are ready."""
    from utils.shared.llm.services import registry

    return registry


def _as_dict(config: Optional[Union[dict, Any]]) -> dict[str, Any]:
    """Accept a plain dict or an object exposing the same attributes."""
    if config is None:
        return {}
    if isinstance(config, dict):
        return config
    out: dict[str, Any] = {}
    for key in ("provider", "model", "base_url", "api_key"):
        value = getattr(config, key, None)
        if value is not None:
            out[key] = value
    return out


def _clean(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def _inline_provider(base_url: str, model: str, api_key: str) -> ResolvedProvider:
    """Compatibility path for a client still sending ``{base_url, model, api_key}``.

    Deprecated. It exists so a browser holding the old settings shape does not
    hard-fail on its next turn; the key it carries is used for this one request
    and never stored or echoed back.
    """
    model = model or LLM_MODEL
    if not model:
        raise LLMProviderError(
            "No model was specified for the custom endpoint.",
            code="no_model",
            provider="inline",
        )
    api_key = api_key or LLM_API_KEY
    config = build_config(
        "inline",
        "openai_compatible",
        label="Custom endpoint",
        base_url=base_url,
        api_key=api_key or None,
        default_model=model,
        connect_timeout=5.0,
        timeout=300.0,
    )
    return ResolvedProvider(
        slug="inline",
        label="Custom endpoint",
        model=model,
        source="inline",
        adapter=build_provider(config),
    )


def resolve_provider(config: Optional[Union[dict, Any]] = None) -> ResolvedProvider:
    """Turn a per-request override into a live adapter plus a model id.

    ``config`` is ``{"provider": slug, "model": id}``; both are optional and
    fall back to the registry's default provider and that provider's default
    model. Every failure is an :class:`LLMProviderError` carrying a ``code`` —
    the point of the rewrite is that "wrong key" and "wrong model", the two
    states a provider dropdown makes common, are reportable rather than
    indistinguishable from success.
    """
    cfg = _as_dict(config)
    slug = _clean(cfg.get("provider"))
    model = _clean(cfg.get("model"))
    base_url = _clean(cfg.get("base_url"))

    # Legacy shape: no slug, but an endpoint spelled out inline.
    if not slug and base_url:
        return _inline_provider(base_url, model, _clean(cfg.get("api_key")))

    registry = _registry()
    try:
        if not slug:
            slug = registry.default_provider_slug() or ""
        entry = registry.get_provider(slug) if slug else None
    except LLMProviderError:
        raise
    except Exception as exc:
        raise LLMProviderError(
            f"The provider registry could not be read: {_redact(exc)}",
            code="registry_unavailable",
        ) from None

    if not slug:
        # Nothing registered at all: honour an environment-only deployment
        # before giving up, so `LLM_BASE_URL=... LLM_MODEL=...` still runs.
        if LLM_BASE_URL:
            return _inline_provider(LLM_BASE_URL, model, LLM_API_KEY)
        raise LLMProviderError(
            "No LLM provider is configured. Add one in Settings -> LLM.",
            code="no_provider",
        )
    if entry is None:
        raise LLMProviderError(
            f"No LLM provider named '{slug}' is configured.",
            code="provider_not_found",
            provider=slug,
        )
    if not entry.enabled:
        raise LLMProviderError(
            f"The '{entry.label}' provider is disabled.",
            code="provider_disabled",
            provider=slug,
        )
    if entry.needs_key and not entry.has_key:
        raise LLMProviderError(
            f"The '{entry.label}' provider has no API key set.",
            code="missing_api_key",
            provider=slug,
        )

    model = model or entry.default_model or LLM_MODEL
    if not model:
        raise LLMProviderError(
            f"No model is selected for '{entry.label}'. Pick one in Settings -> LLM.",
            code="no_model",
            provider=slug,
        )

    try:
        adapter = registry.build(entry)
    except Exception as exc:
        raise LLMProviderError(
            f"Could not initialise '{entry.label}': "
            f"{_redact(exc, (entry.api_key, LLM_API_KEY))}",
            code="config_error",
            provider=slug,
            model=model,
        ) from None

    return ResolvedProvider(
        slug=slug,
        label=entry.label,
        model=model,
        source=entry.source,
        adapter=adapter,
    )


# --- generation ---------------------------------------------------------------

#: Most specific first — ContextLengthError subclasses InvalidRequestError.
_ERROR_CODES: tuple[tuple[type, str], ...] = (
    (AuthError, "auth_error"),
    (NotFoundError, "model_not_found"),
    (ContextLengthError, "context_length"),
    (InvalidRequestError, "invalid_request"),
    (RateLimitError, "rate_limited"),
    (OverloadedError, "overloaded"),
    (ServerError, "server_error"),
    (ConnectionError_, "unreachable"),
    (TimeoutError_, "timeout"),
    (ContentFilterError, "content_filter"),
    (CapabilityError, "unsupported"),
    (ConfigError, "config_error"),
)


def _translate(exc: LLMError, target: ResolvedProvider) -> LLMProviderError:
    """Map a vendored-layer error onto the agent's error type, redacted."""
    code = next((c for kind, c in _ERROR_CODES if isinstance(exc, kind)), "provider_error")
    secrets = _secrets_for(target)

    if code == "auth_error":
        # Deliberately NOT the upstream body: some servers quote the rejected
        # key back at you, and that body is on its way to a browser.
        message = (
            f"'{target.label}' rejected the API key. "
            "Check it in Settings -> LLM."
        )
    elif code == "unreachable":
        message = (
            f"Could not reach '{target.label}'. "
            "Check the server is running and the base URL is right."
        )
    elif code == "model_not_found":
        message = (
            f"'{target.model}' is not available on '{target.label}'. "
            "Pick a different model in Settings -> LLM."
        )
    elif code == "timeout":
        message = f"'{target.label}' did not respond in time."
    else:
        message = _redact(exc, secrets)

    return LLMProviderError(
        message,
        code=code,
        provider=target.slug,
        model=target.model,
        status_code=getattr(exc, "status_code", None),
        retryable=bool(getattr(exc, "retryable", False)),
    )


def stream_chat(
    messages: Iterable[Union[Message, dict]],
    tools: Optional[list[ToolDef]] = None,
    config: Optional[Union[dict, Any]] = None,
    *,
    params: Optional[GenParams] = None,
    resolved: Optional[ResolvedProvider] = None,
) -> Iterator[StreamChunk]:
    """Stream one completion as normalized chunks.

    The adapter has already done the hard part: partial tool-call JSON is
    assembled, reasoning text is separated from answer text, and the terminating
    ``done`` chunk carries the provider's native final message in ``raw`` where
    one exists (Anthropic), which is what lets the caller replay the assistant
    turn with its thinking-block signatures intact.
    """
    target = resolved or resolve_provider(config)
    try:
        yield from target.adapter.stream(
            messages, model=target.model, tools=tools or None, params=params
        )
    except LLMProviderError:
        raise
    except LLMError as exc:
        # `from None` on purpose: the chained original can carry the key in its
        # message, and the route puts tracebacks on the wire.
        raise _translate(exc, target) from None
    except Exception as exc:
        raise LLMProviderError(
            _redact(exc, _secrets_for(target)) or type(exc).__name__,
            code="provider_error",
            provider=target.slug,
            model=target.model,
        ) from None
