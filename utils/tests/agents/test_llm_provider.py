"""The agent's provider seam: server-side resolution, and errors that stay quiet
about secrets."""

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from utils.agents.providers import llm
from utils.agents.providers.llm import (
    LLMProviderError,
    resolve_provider,
    stream_chat,
)
from utils.shared.llm.kit.errors import AuthError, ConnectionError_, ServerError
from utils.shared.llm.kit.types import Message, StreamChunk

SECRET = "sk-super-secret-key-value"


def _entry(**kw):
    """Stand-in for a ``registry.ProviderEntry``."""
    defaults = dict(
        slug="local",
        label="Local model server",
        kind="openai_compatible",
        api_key="",
        default_model="qwen3:8b",
        enabled=True,
        source="config",
        needs_key=False,
        has_key=False,
    )
    defaults.update(kw)
    return SimpleNamespace(**defaults)


class _Adapter:
    """Minimal Provider stand-in: records the call, replays canned chunks."""

    def __init__(self, chunks=(), error=None, api_key=SECRET):
        self.config = SimpleNamespace(api_key=api_key)
        self.chunks = list(chunks)
        self.error = error
        self.calls = []

    def stream(self, messages, *, model=None, tools=None, params=None, **kw):
        self.calls.append({"messages": messages, "model": model, "tools": tools})
        if self.error:
            raise self.error
        yield from self.chunks


def _registry(entry=None, adapter=None, default="local"):
    return SimpleNamespace(
        default_provider_slug=lambda: default,
        get_provider=lambda slug: entry if (entry and slug == entry.slug) else None,
        build=lambda e: adapter or _Adapter(),
    )


# --- resolution ---------------------------------------------------------------

def test_resolves_the_default_provider_when_nothing_is_requested():
    adapter = _Adapter()
    with patch.object(llm, "_registry", return_value=_registry(_entry(), adapter)):
        resolved = resolve_provider(None)
    assert resolved.slug == "local"
    assert resolved.model == "qwen3:8b"      # the entry's default_model
    assert resolved.adapter is adapter


def test_resolves_the_requested_provider_and_model():
    entry = _entry(slug="anthropic", label="Anthropic", needs_key=True, has_key=True)
    with patch.object(llm, "_registry", return_value=_registry(entry)):
        resolved = resolve_provider({"provider": "anthropic", "model": "claude-x"})
    assert (resolved.slug, resolved.model) == ("anthropic", "claude-x")


def test_unknown_provider_is_reported_not_guessed():
    with patch.object(llm, "_registry", return_value=_registry(_entry())):
        with pytest.raises(LLMProviderError) as exc:
            resolve_provider({"provider": "nope"})
    assert exc.value.code == "provider_not_found"


def test_disabled_provider_and_missing_key_have_distinct_codes():
    with patch.object(llm, "_registry", return_value=_registry(_entry(enabled=False))):
        with pytest.raises(LLMProviderError) as disabled:
            resolve_provider({"provider": "local"})
    assert disabled.value.code == "provider_disabled"

    entry = _entry(needs_key=True, has_key=False)
    with patch.object(llm, "_registry", return_value=_registry(entry)):
        with pytest.raises(LLMProviderError) as no_key:
            resolve_provider({"provider": "local"})
    assert no_key.value.code == "missing_api_key"


def test_provider_without_a_model_is_an_error_not_a_placeholder():
    entry = _entry(default_model="")
    with patch.object(llm, "LLM_MODEL", ""):
        with patch.object(llm, "_registry", return_value=_registry(entry)):
            with pytest.raises(LLMProviderError) as exc:
                resolve_provider({"provider": "local"})
    assert exc.value.code == "no_model"


def test_legacy_inline_config_still_resolves_without_the_registry():
    # An un-updated client still sends {base_url, model, api_key}; it must keep
    # working rather than hard-failing on its next turn.
    def boom():  # pragma: no cover - must not be called
        raise AssertionError("the registry must not be consulted for an inline config")

    with patch.object(llm, "_registry", side_effect=boom):
        resolved = resolve_provider(
            {"base_url": "http://box:9090/v1", "model": "m", "api_key": SECRET}
        )
    assert resolved.source == "inline"
    assert resolved.model == "m"
    # The key is used for the call and never re-exposed.
    assert SECRET not in repr(resolved)


def test_env_only_deployment_still_runs_when_nothing_is_registered():
    empty = SimpleNamespace(
        default_provider_slug=lambda: None,
        get_provider=lambda slug: None,
        build=lambda e: None,
    )
    with patch.object(llm, "_registry", return_value=empty):
        with patch.object(llm, "LLM_BASE_URL", "http://env-box:9090/v1"), patch.object(
            llm, "LLM_MODEL", "env-model"
        ):
            resolved = resolve_provider(None)
        assert (resolved.source, resolved.model) == ("inline", "env-model")

        # ...and with nothing in the environment either, it says so.
        with patch.object(llm, "LLM_BASE_URL", ""):
            with pytest.raises(LLMProviderError) as exc:
                resolve_provider(None)
    assert exc.value.code == "no_provider"


# --- streaming and error translation ------------------------------------------

def test_stream_chat_forwards_model_and_tools_and_yields_chunks():
    adapter = _Adapter(chunks=[StreamChunk(type="text", text="hi")])
    with patch.object(llm, "_registry", return_value=_registry(_entry(), adapter)):
        chunks = list(stream_chat([Message.user("hi")], tools=[], config={"model": "m"}))
    assert [c.type for c in chunks] == ["text"]
    assert adapter.calls[0]["model"] == "m"
    assert adapter.calls[0]["tools"] is None      # an empty tool list is "no tools"


def test_auth_failure_surfaces_as_an_error_and_never_echoes_the_key():
    # Several servers quote the rejected key back in the 401 body, and that body
    # is on its way to a browser.
    error = AuthError(
        f"Incorrect API key provided: {SECRET}", provider="local", status_code=401
    )
    adapter = _Adapter(error=error)
    with patch.object(llm, "_registry", return_value=_registry(_entry(), adapter)):
        with pytest.raises(LLMProviderError) as exc:
            list(stream_chat([Message.user("hi")]))

    event = exc.value.to_event()
    assert exc.value.code == "auth_error"
    assert exc.value.retryable is False
    assert SECRET not in event["message"]
    assert SECRET not in str(event)
    assert "Settings" in event["message"]


def test_other_provider_errors_keep_their_text_but_lose_the_secret():
    adapter = _Adapter(error=ServerError(f"upstream said {SECRET} is stale", status_code=503))
    with patch.object(llm, "_registry", return_value=_registry(_entry(), adapter)):
        with pytest.raises(LLMProviderError) as exc:
            list(stream_chat([Message.user("hi")]))
    assert exc.value.code == "server_error"
    assert exc.value.retryable is True
    assert SECRET not in exc.value.message
    assert "***" in exc.value.message


def test_unreachable_server_is_reported_as_such():
    adapter = _Adapter(error=ConnectionError_("connection refused"))
    with patch.object(llm, "_registry", return_value=_registry(_entry(), adapter)):
        with pytest.raises(LLMProviderError) as exc:
            list(stream_chat([Message.user("hi")]))
    assert exc.value.code == "unreachable"
    assert exc.value.retryable is True


def test_redaction_strips_credentials_embedded_in_a_url():
    assert llm._redact("failed calling https://user:tok@host/v1") == (
        "failed calling https://***@host/v1"
    )
