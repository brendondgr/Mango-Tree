"""OAuth portal flow: PKCE, pending store, authorize URL, code exchange, email
read, account registration, and token refresh. Every network call is injected,
so it all runs offline with no real client credentials."""

from __future__ import annotations

import base64
import json
from urllib.parse import parse_qs, urlparse

import pytest

from utils.apps.mailbox.backend.services import config_store, secrets
from utils.apps.mailbox.backend.services.oauth import flow, pkce, registry, tokens
from utils.apps.mailbox.backend.services.oauth.pending import (
    FilePendingStore,
    MemoryPendingStore,
)
from utils.apps.mailbox.shared.errors import (
    PermissionDeniedError,
    ProviderError,
    ValidationError,
)


@pytest.fixture
def stores(tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_MAILBOX_CONFIG", str(tmp_path / "accounts.json"))
    monkeypatch.setenv("MANGO_MAILBOX_SECRETS", str(tmp_path / "secrets.json"))
    return tmp_path


def _provider(name="gmail"):
    return registry.OAuthProvider(
        name=name,
        authorize_url="https://accounts.example/authorize",
        token_url="https://token.example/token",
        scopes=["https://mail.google.com/", "openid", "email"],
        client_id="CID",
        client_secret="CSEC",
        userinfo_url="https://userinfo.example",
        extra_authorize_params={"access_type": "offline", "prompt": "consent"},
    )


def _id_token(email: str) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"email": email}).encode()).decode().rstrip("=")
    return f"hdr.{payload}.sig"


# --- pkce ---------------------------------------------------------------------

def test_pkce_challenge_is_s256_of_verifier():
    v = pkce.new_verifier()
    import hashlib

    expected = base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).decode().rstrip("=")
    assert pkce.challenge_for(v) == expected
    assert "=" not in v and "=" not in pkce.new_state()


# --- pending store ------------------------------------------------------------

def test_pending_store_is_single_use():
    store = MemoryPendingStore()
    store.put("s1", {"provider": "gmail"}, ttl_seconds=600)
    assert store.take("s1")["provider"] == "gmail"
    assert store.take("s1") is None  # consumed


def test_pending_store_expires():
    clock = {"t": 1000.0}
    store = MemoryPendingStore(now=lambda: clock["t"])
    store.put("s1", {"provider": "gmail"}, ttl_seconds=10)
    clock["t"] = 1011.0
    assert store.take("s1") is None


def test_file_pending_store_round_trip(tmp_path):
    store = FilePendingStore(tmp_path / "pending.json")
    store.put("s1", {"provider": "m365", "verifier": "v"}, ttl_seconds=600)
    taken = store.take("s1")
    assert taken == {"provider": "m365", "verifier": "v"}
    assert store.take("s1") is None


# --- authorize url ------------------------------------------------------------

def test_build_authorize_url_has_pkce_state_and_extras():
    store = MemoryPendingStore()
    url = flow.build_authorize_url(
        "gmail", "http://localhost:32553/api/mailbox/oauth/callback/", store,
        provider_config=_provider(), verifier="VER", state="STATE",
    )
    qs = parse_qs(urlparse(url).query)
    assert qs["client_id"] == ["CID"]
    assert qs["code_challenge_method"] == ["S256"]
    assert qs["code_challenge"] == [pkce.challenge_for("VER")]
    assert qs["state"] == ["STATE"]
    assert qs["access_type"] == ["offline"] and qs["prompt"] == ["consent"]
    # the pending attempt was recorded
    assert store.take("STATE")["verifier"] == "VER"


# --- code exchange + email ----------------------------------------------------

def test_exchange_code_posts_and_returns_tokens():
    seen = {}

    def fake(url, data):
        seen.update({"url": url, "data": data})
        return 200, {"access_token": "AT", "refresh_token": "RT", "id_token": _id_token("u@gmail.com")}

    body = flow.exchange_code(
        "gmail", "CODE", "VER", "http://cb", provider_config=_provider(), transport=fake
    )
    assert body["refresh_token"] == "RT"
    assert seen["data"]["grant_type"] == "authorization_code"
    assert seen["data"]["code_verifier"] == "VER"
    assert seen["data"]["client_secret"] == "CSEC"


def test_exchange_code_error_is_permission_denied():
    with pytest.raises(PermissionDeniedError):
        flow.exchange_code(
            "gmail", "CODE", "VER", "http://cb", provider_config=_provider(),
            transport=lambda url, data: (400, {"error": "invalid_grant"}),
        )


def test_read_email_from_id_token():
    email = flow.read_email(
        "gmail", {"id_token": _id_token("alice@gmail.com")}, provider_config=_provider()
    )
    assert email == "alice@gmail.com"


def test_read_email_falls_back_to_userinfo():
    email = flow.read_email(
        "gmail", {"access_token": "AT"}, provider_config=_provider(),
        userinfo_transport=lambda url, tok: (200, {"email": "bob@gmail.com"}),
    )
    assert email == "bob@gmail.com"


def test_read_email_unresolvable_is_provider_error():
    with pytest.raises(ProviderError):
        flow.read_email("m365", {"id_token": "no.dots"}, provider_config=_provider("m365"))


# --- registration + complete_login --------------------------------------------

def test_register_account_stores_refresh_and_upserts(stores):
    account = flow.register_account(
        "gmail", "user@gmail.com", "RT-123", config_store=config_store, secrets=secrets
    )
    assert account["provider"] == "gmail"
    assert account["email"] == "user@gmail.com"
    assert account["status"] == "ok"
    # refresh token in the secret store only, never in accounts.json
    from pathlib import Path

    assert "RT-123" not in Path(stores / "accounts.json").read_text()
    assert secrets.get_credential(account["credential_ref"]) == "RT-123"
    # reconnecting the same email upserts (no duplicate)
    again = flow.register_account(
        "gmail", "user@gmail.com", "RT-456", config_store=config_store, secrets=secrets
    )
    assert again["id"] == account["id"]
    assert len(config_store.list_accounts()) == 1


def test_complete_login_end_to_end(stores):
    state_data = {"provider": "gmail", "verifier": "VER", "redirect_uri": "http://cb"}
    account = flow.complete_login(
        state_data, "CODE",
        config_store=config_store, secrets=secrets, provider_config=_provider(),
        transport=lambda url, data: (
            200, {"access_token": "AT", "refresh_token": "RT", "id_token": _id_token("me@gmail.com")}
        ),
    )
    assert account["email"] == "me@gmail.com"
    assert config_store.get_account(account["id"]).status == "ok"


def test_complete_login_without_refresh_token_denies(stores):
    with pytest.raises(PermissionDeniedError):
        flow.complete_login(
            {"provider": "gmail", "verifier": "V", "redirect_uri": "http://cb"}, "CODE",
            config_store=config_store, secrets=secrets, provider_config=_provider(),
            transport=lambda url, data: (200, {"access_token": "AT", "id_token": _id_token("x@gmail.com")}),
        )


# --- token refresh ------------------------------------------------------------

class _Acct:
    def __init__(self, id="a1", provider="gmail", credential_ref="REF"):
        self.id = id
        self.provider = provider
        self.credential_ref = credential_ref


def test_get_access_token_caches():
    cache = {}
    calls = {"n": 0}

    def fake(url, data):
        calls["n"] += 1
        return 200, {"access_token": "AT", "expires_in": 3600}

    kw = dict(get_refresh=lambda ref: "RT", transport=fake, provider_config=_provider(), cache=cache, now=1000.0)
    assert tokens.get_access_token(_Acct(), **kw) == "AT"
    assert tokens.get_access_token(_Acct(), **kw) == "AT"
    assert calls["n"] == 1  # second call served from cache


def test_get_access_token_persists_rotated_refresh():
    rotated = {}
    tokens.get_access_token(
        _Acct(), get_refresh=lambda ref: "RT-old", set_refresh=lambda ref, v: rotated.update({ref: v}),
        transport=lambda url, data: (200, {"access_token": "AT", "refresh_token": "RT-new", "expires_in": 3600}),
        provider_config=_provider(), cache={}, now=0.0,
    )
    assert rotated["REF"] == "RT-new"


def test_get_access_token_dead_refresh_denies():
    with pytest.raises(PermissionDeniedError) as exc:
        tokens.get_access_token(
            _Acct(), get_refresh=lambda ref: "RT",
            transport=lambda url, data: (400, {"error": "invalid_grant"}),
            provider_config=_provider(), cache={}, now=0.0,
        )
    assert exc.value.details["action"] == "reauthorize"


def test_get_access_token_missing_refresh_denies():
    with pytest.raises(PermissionDeniedError):
        tokens.get_access_token(
            _Acct(credential_ref=None), get_refresh=lambda ref: None,
            provider_config=_provider(), cache={}, now=0.0,
        )


# --- registry -----------------------------------------------------------------

def test_registry_unconfigured_denies(monkeypatch):
    monkeypatch.delenv("OAUTH_GMAIL_CLIENT_ID", raising=False)
    with pytest.raises(PermissionDeniedError):
        registry.get_provider("gmail")


def test_registry_unknown_provider_validation_error():
    with pytest.raises(ValidationError):
        registry.get_provider("yahoo")


def test_registry_configured(monkeypatch):
    monkeypatch.setenv("OAUTH_GMAIL_CLIENT_ID", "abc.apps.googleusercontent.com")
    monkeypatch.setenv("OAUTH_GMAIL_CLIENT_SECRET", "GOCSPX-x")
    p = registry.get_provider("gmail")
    assert p.client_id == "abc.apps.googleusercontent.com"
    assert p.token_url == "https://oauth2.googleapis.com/token"


# --- build_account integration (env-configured client) ------------------------

def test_build_account_mints_via_refresh(stores, monkeypatch):
    monkeypatch.setenv("OAUTH_GMAIL_CLIENT_ID", "CID")
    monkeypatch.setenv("OAUTH_GMAIL_CLIENT_SECRET", "CSEC")
    from utils.apps.mailbox.backend.services import providers

    account = config_store.save_account(
        {"provider": "gmail", "display_name": "Work", "email": "w@gmail.com",
         "credential_ref": "REF"}
    )
    secrets.set_credential("REF", "RT-live")
    minted = providers.build_account(
        account.id,
        transport=lambda url, data: (200, {"access_token": "AT-LIVE", "expires_in": 3600}),
        now=0.0,
    )
    assert minted.access_token == "AT-LIVE"
    assert minted.auth == "oauth2"
