"""OAuth refresh-token model: cached tokens, on-demand refresh, invalid_grant,
and end-to-end account building with the refreshed token cached back. The token
endpoint is injected, so everything runs offline."""

from __future__ import annotations

import pytest

from utils.apps.mailbox.backend.services import config_store, oauth, providers, secrets
from utils.apps.mailbox.shared.errors import PermissionDeniedError


@pytest.fixture
def stores(tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_MAILBOX_CONFIG", str(tmp_path / "accounts.json"))
    monkeypatch.setenv("MANGO_MAILBOX_SECRETS", str(tmp_path / "secrets.json"))
    return tmp_path


def _bundle(**over):
    base = {"refresh_token": "RT", "client_id": "CID", "client_secret": "CSEC"}
    base.update(over)
    return base


# --- resolve_access_token -----------------------------------------------------

def test_returns_cached_token_without_calling_endpoint():
    def boom(url, form):
        raise AssertionError("should not refresh")

    token = oauth.resolve_access_token(
        "gmail", _bundle(access_token="AT0", access_token_expiry=1000.0),
        now=500.0, transport=boom,
    )
    assert token == "AT0"


def test_refreshes_when_expired_and_caches_back():
    seen = {}

    def fake(url, form):
        seen["url"] = url
        seen["form"] = form
        return 200, {"access_token": "AT1", "expires_in": 3600}

    cached = {}
    token = oauth.resolve_access_token(
        "gmail", _bundle(access_token="STALE", access_token_expiry=100.0),
        now=1000.0, transport=fake, on_refresh=lambda b: cached.update(b),
    )
    assert token == "AT1"
    assert seen["url"] == oauth.TOKEN_ENDPOINTS["gmail"]
    assert seen["form"]["grant_type"] == "refresh_token"
    assert seen["form"]["refresh_token"] == "RT"
    assert cached["access_token"] == "AT1"
    assert cached["access_token_expiry"] == 1000.0 + 3600


def test_m365_refresh_includes_scope_gmail_does_not():
    forms = {}

    def fake(url, form):
        forms[form.get("client_id")] = form
        return 200, {"access_token": "X", "expires_in": 3600}

    oauth.resolve_access_token("m365", _bundle(client_id="M"), now=0.0, transport=fake)
    oauth.resolve_access_token("gmail", _bundle(client_id="G"), now=0.0, transport=fake)
    assert "scope" in forms["M"]
    assert "scope" not in forms["G"]


def test_static_token_without_refresh_is_returned():
    # A bare access token (dev mode) with no refresh token is used as-is.
    token = oauth.resolve_access_token("gmail", {"access_token": "ONLY"}, now=0.0)
    assert token == "ONLY"


def test_missing_refresh_and_no_token_denies():
    with pytest.raises(PermissionDeniedError) as exc:
        oauth.resolve_access_token("gmail", {"client_id": "C"}, now=0.0)
    assert exc.value.details["action"] == "reauthorize"


def test_missing_client_credentials_denies():
    with pytest.raises(PermissionDeniedError):
        oauth.resolve_access_token("gmail", {"refresh_token": "RT"}, now=0.0)


def test_invalid_grant_is_terminal_permission_denied():
    with pytest.raises(PermissionDeniedError) as exc:
        oauth.resolve_access_token(
            "gmail", _bundle(), now=0.0,
            transport=lambda url, form: (400, {"error": "invalid_grant"}),
        )
    assert exc.value.details["action"] == "reauthorize"
    assert exc.value.details["status"] == 400


# --- registry integration -----------------------------------------------------

def test_build_account_mints_and_caches_token(stores):
    account = config_store.save_account(
        {"provider": "gmail", "display_name": "Work", "email": "w@gmail.com",
         "credential_ref": "MAIL_GMAIL_WORK"}
    )
    secrets.set_credential("MAIL_GMAIL_WORK", _bundle())

    minted = providers.build_account(
        account.id,
        transport=lambda url, form: (200, {"access_token": "AT-LIVE", "expires_in": 3600}),
        now=2000.0,
    )
    assert minted.access_token == "AT-LIVE"
    assert minted.auth == "oauth2"

    # the refreshed token is cached back into the secret bundle
    stored = secrets.get_credential("MAIL_GMAIL_WORK")
    assert stored["access_token"] == "AT-LIVE"
    assert stored["access_token_expiry"] == 2000.0 + 3600
    assert stored["refresh_token"] == "RT"  # preserved


def test_build_account_dead_refresh_token_denies(stores):
    account = config_store.save_account(
        {"provider": "gmail", "display_name": "W", "email": "w@gmail.com",
         "credential_ref": "REF"}
    )
    secrets.set_credential("REF", _bundle())
    with pytest.raises(PermissionDeniedError):
        providers.build_account(
            account.id, transport=lambda url, form: (400, {"error": "invalid_grant"}), now=0.0
        )
