"""Stage 4 verification: the DRF API over the mailbox services.

Accounts CRUD returns settings only (never a secret); the credential endpoint is
write-only; the test/messages/folders endpoints deny when an account has no
stored credential (no network is attempted). File-backed stores are pointed at
throwaway paths via env.
"""

from __future__ import annotations

import base64
import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import pytest
from rest_framework.test import APIClient

from utils.apps.mailbox.backend.services.oauth import transport as oauth_transport


@pytest.fixture
def stores(tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_MAILBOX_CONFIG", str(tmp_path / "accounts.json"))
    monkeypatch.setenv("MANGO_MAILBOX_SECRETS", str(tmp_path / "secrets.json"))
    monkeypatch.setenv("MANGO_MAILBOX_PENDING", str(tmp_path / "pending.json"))
    monkeypatch.setenv("MANGO_MAILBOX_CACHE", str(tmp_path / "cache"))
    return tmp_path


def _id_token(email: str) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"email": email}).encode()).decode().rstrip("=")
    return f"hdr.{payload}.sig"


@pytest.fixture
def client(stores):
    return APIClient()


def _create(client, **overrides):
    payload = {"provider": "gmail", "display_name": "Work", "email": "w@x.com"}
    payload.update(overrides)
    return client.post("/api/mailbox/accounts/", data=json.dumps(payload),
                       content_type="application/json")


# --- accounts CRUD ------------------------------------------------------------

def test_list_empty_envelope(client):
    res = client.get("/api/mailbox/accounts/")
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"count", "next", "previous", "results"}
    assert body["count"] == 0


def test_create_returns_settings_with_has_credential_false(client):
    res = _create(client)
    assert res.status_code == 201
    body = res.json()
    assert body["id"].startswith("acc_")
    assert body["provider"] == "gmail"
    assert body["has_credential"] is False
    assert client.get("/api/mailbox/accounts/").json()["count"] == 1


def test_create_validation_error(client):
    res = _create(client, provider="aol")
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"


def test_update_upserts_on_url_id(client):
    account_id = _create(client).json()["id"]
    res = client.put(
        f"/api/mailbox/accounts/{account_id}/",
        data=json.dumps({"provider": "gmail", "display_name": "Renamed", "email": "w@x.com"}),
        content_type="application/json",
    )
    assert res.status_code == 200
    assert res.json()["display_name"] == "Renamed"
    assert client.get("/api/mailbox/accounts/").json()["count"] == 1


def test_delete_then_missing_returns_404(client):
    account_id = _create(client).json()["id"]
    assert client.delete(f"/api/mailbox/accounts/{account_id}/").status_code == 204
    assert client.delete(f"/api/mailbox/accounts/{account_id}/").status_code == 404


# --- credential (write-only) --------------------------------------------------

def test_credential_is_write_only_and_never_echoed(client, stores):
    account_id = _create(client).json()["id"]
    res = client.put(
        f"/api/mailbox/accounts/{account_id}/credential/",
        data=json.dumps({"value": "SUPER-SECRET-TOKEN"}),
        content_type="application/json",
    )
    assert res.status_code == 200
    assert "SUPER-SECRET-TOKEN" not in json.dumps(res.json())
    assert res.json()["has_credential"] is True

    # the account now reports has_credential, but no secret is returned anywhere
    listing = client.get("/api/mailbox/accounts/").json()
    assert listing["results"][0]["has_credential"] is True
    assert "SUPER-SECRET-TOKEN" not in json.dumps(listing)
    # the secret value is not in the config file either
    assert "SUPER-SECRET-TOKEN" not in Path(stores / "accounts.json").read_text()


def test_credential_for_missing_account_404(client):
    res = client.put(
        "/api/mailbox/accounts/ghost/credential/",
        data=json.dumps({"value": "x"}),
        content_type="application/json",
    )
    assert res.status_code == 404


# --- test / messages / folders deny without credentials (no network) ----------

def test_test_endpoint_without_credentials_reports_error_status(client):
    account_id = _create(client).json()["id"]
    res = client.post(f"/api/mailbox/accounts/{account_id}/test/")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is False
    assert body["status"] == "error"


def test_messages_returns_empty_cache_without_network(client):
    # messages GET reads the local cache (no IMAP); a fresh account is just empty.
    account_id = _create(client).json()["id"]
    res = client.get(f"/api/mailbox/accounts/{account_id}/messages/")
    assert res.status_code == 200
    body = res.json()
    assert body["messages"] == [] and body["count"] == 0
    assert body["sync"]["state"] in ("idle", "syncing", "error")


def test_sync_without_credentials_denied(client):
    # syncing requires credentials; with none stored it denies (no network).
    account_id = _create(client).json()["id"]
    res = client.post(f"/api/mailbox/accounts/{account_id}/sync/")
    assert res.status_code == 403
    assert res.json()["code"] == "permission_denied"


def test_folders_without_credentials_denied(client):
    account_id = _create(client).json()["id"]
    res = client.get(f"/api/mailbox/accounts/{account_id}/folders/")
    assert res.status_code == 403


def test_move_without_credentials_denied(client):
    account_id = _create(client).json()["id"]
    res = client.post(
        f"/api/mailbox/accounts/{account_id}/move/",
        data=json.dumps({"uids": ["1"], "dest": "Archive"}),
        content_type="application/json",
    )
    assert res.status_code == 403
    assert res.json()["code"] == "permission_denied"


def test_mark_without_credentials_denied(client):
    account_id = _create(client).json()["id"]
    res = client.post(
        f"/api/mailbox/accounts/{account_id}/mark/",
        data=json.dumps({"uids": ["1"], "read": True}),
        content_type="application/json",
    )
    assert res.status_code == 403
    assert res.json()["code"] == "permission_denied"


def test_move_empty_uids_is_validation_error(client):
    account_id = _create(client).json()["id"]
    res = client.post(
        f"/api/mailbox/accounts/{account_id}/move/",
        data=json.dumps({"uids": [], "dest": "Archive"}),
        content_type="application/json",
    )
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"


def test_soft_delete_without_credentials_denied(client):
    account_id = _create(client).json()["id"]
    res = client.post(
        f"/api/mailbox/accounts/{account_id}/delete/",
        data=json.dumps({"uids": ["1"]}),
        content_type="application/json",
    )
    assert res.status_code == 403
    assert res.json()["code"] == "permission_denied"


def test_permanent_delete_without_confirm_denied_before_network(client):
    # The confirm gate fires in the view before any account/network work.
    account_id = _create(client).json()["id"]
    res = client.post(
        f"/api/mailbox/accounts/{account_id}/delete/",
        data=json.dumps({"uids": ["1"], "permanent": True}),
        content_type="application/json",
    )
    assert res.status_code == 403
    assert res.json()["code"] == "permission_denied"
    assert "confirm" in res.json()["message"].lower()


def test_messages_for_unknown_account_404(client):
    res = client.get("/api/mailbox/accounts/ghost/messages/")
    assert res.status_code == 404


# --- OAuth portal endpoints ---------------------------------------------------

def test_oauth_start_unconfigured_denies(client, monkeypatch):
    monkeypatch.delenv("OAUTH_GMAIL_CLIENT_ID", raising=False)
    res = client.get("/api/mailbox/oauth/start/?provider=gmail")
    assert res.status_code == 403
    assert res.json()["code"] == "permission_denied"


def test_oauth_start_unsupported_provider(client):
    res = client.get("/api/mailbox/oauth/start/?provider=yahoo")
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"


def test_oauth_start_configured_returns_authorize_url(client, monkeypatch):
    monkeypatch.setenv("OAUTH_GMAIL_CLIENT_ID", "CID")
    res = client.get("/api/mailbox/oauth/start/?provider=gmail")
    assert res.status_code == 200
    url = res.json()["authorize_url"]
    assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth")
    assert "code_challenge_method=S256" in url


def test_oauth_callback_creates_account(client, stores, monkeypatch):
    monkeypatch.setenv("OAUTH_GMAIL_CLIENT_ID", "CID")
    # 1. start records the pending attempt; capture its state from the authorize URL
    start = client.get("/api/mailbox/oauth/start/?provider=gmail")
    state = parse_qs(urlparse(start.json()["authorize_url"]).query)["state"][0]
    # 2. the provider would redirect back with code+state; stub the token exchange
    monkeypatch.setattr(
        oauth_transport, "post_form",
        lambda url, data: (
            200,
            {"access_token": "AT", "refresh_token": "RT-X", "id_token": _id_token("me@gmail.com")},
        ),
    )
    res = client.get(f"/api/mailbox/oauth/callback/?code=CODE&state={state}")
    assert res.status_code == 302
    assert "mailbox_added=" in res["Location"]
    accounts = client.get("/api/mailbox/accounts/").json()["results"]
    assert any(a["email"] == "me@gmail.com" and a["has_credential"] for a in accounts)
    assert "RT-X" not in Path(stores / "accounts.json").read_text()
    assert "RT-X" in Path(stores / "secrets.json").read_text()


def test_oauth_callback_invalid_state_redirects_with_error(client):
    res = client.get("/api/mailbox/oauth/callback/?code=CODE&state=bogus")
    assert res.status_code == 302
    assert "mailbox_error=invalid_state" in res["Location"]
