"""Stage 4 verification: the DRF API over the mailbox services.

Accounts CRUD returns settings only (never a secret); the credential endpoint is
write-only; the test/messages/folders endpoints deny when an account has no
stored credential (no network is attempted). File-backed stores are pointed at
throwaway paths via env.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from rest_framework.test import APIClient


@pytest.fixture
def stores(tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_MAILBOX_CONFIG", str(tmp_path / "accounts.json"))
    monkeypatch.setenv("MANGO_MAILBOX_SECRETS", str(tmp_path / "secrets.json"))
    return tmp_path


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


def test_oauth_bundle_credential_stored_but_never_echoed(client, stores):
    account_id = _create(client).json()["id"]  # gmail
    res = client.put(
        f"/api/mailbox/accounts/{account_id}/credential/",
        data=json.dumps({
            "refresh_token": "RT-SECRET", "client_id": "CID", "client_secret": "CSEC-SECRET",
        }),
        content_type="application/json",
    )
    assert res.status_code == 200
    assert res.json()["has_credential"] is True
    # no part of the bundle is echoed
    body = json.dumps(res.json())
    assert "RT-SECRET" not in body and "CSEC-SECRET" not in body
    # the refresh token lives only in the secrets file, never in accounts.json
    assert "RT-SECRET" not in Path(stores / "accounts.json").read_text()
    assert "RT-SECRET" in Path(stores / "secrets.json").read_text()


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


def test_messages_without_credentials_denied(client):
    account_id = _create(client).json()["id"]
    res = client.get(f"/api/mailbox/accounts/{account_id}/messages/")
    assert res.status_code == 403
    assert res.json()["code"] == "permission_denied"


def test_folders_without_credentials_denied(client):
    account_id = _create(client).json()["id"]
    res = client.get(f"/api/mailbox/accounts/{account_id}/folders/")
    assert res.status_code == 403


def test_messages_for_unknown_account_404(client):
    res = client.get("/api/mailbox/accounts/ghost/messages/")
    assert res.status_code == 404
