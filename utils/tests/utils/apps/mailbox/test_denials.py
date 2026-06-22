"""Stage 11: the denial matrix — the cases that must fail, gathered in one place.

Covers: no-confirm send, missing credentials, unknown account, unknown provider,
secret-never-in-config, secret-never-in-API-response, out-of-scope host, out-of-
scope path, and Graph 403 -> permission_denied. Everything runs offline.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest
import yaml
from django.conf import settings
from rest_framework.test import APIClient

from utils.apps.mailbox.agent import tools
from utils.apps.mailbox.backend.services import config_store, messages, providers
from utils.apps.mailbox.backend.services.providers import m365
from utils.apps.mailbox.shared.errors import (
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)
from utils.apps.mailbox.shared.schemas import AccountConfig


@pytest.fixture
def stores(tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_MAILBOX_CONFIG", str(tmp_path / "accounts.json"))
    monkeypatch.setenv("MANGO_MAILBOX_SECRETS", str(tmp_path / "secrets.json"))
    return tmp_path


# --- 1. no-confirm send -------------------------------------------------------

def test_send_without_confirm_is_denied():
    payload = tools.send_message(
        account="a1", to=["x@y.com"], subject="s", body="b", service=MagicMock()
    )
    assert payload["error"]["code"] == "permission_denied"


# --- 2. missing credentials ---------------------------------------------------

def test_missing_credentials_deny_before_any_network(stores):
    account = config_store.save_account(
        {"provider": "gmail", "display_name": "Work", "email": "w@x.com"}
    )
    # No credential stored -> resolved MailAccount has no token -> connect denies
    # (require_credentials raises before the IMAP factory is ever called).
    with pytest.raises(PermissionDeniedError):
        messages.list_messages(account.id, imap_factory=lambda a: pytest.fail("no network"))


# --- 3. unknown account / 4. unknown provider ---------------------------------

def test_unknown_account_is_not_found(stores):
    with pytest.raises(NotFoundError):
        providers.build_account("ghost")


def test_unknown_provider_is_validation_error():
    bogus = AccountConfig(id="x", provider="aol", display_name="x", email="e@x.com")
    with pytest.raises(ValidationError):
        providers.build_account_from_config(bogus)


# --- 5. secret never written to accounts.json ---------------------------------

def test_secret_never_written_to_config(stores):
    config_store.save_account({
        "provider": "gmail", "display_name": "W", "email": "w@x.com",
        "access_token": "LEAK-TO-DISK",
    })
    assert "LEAK-TO-DISK" not in Path(stores / "accounts.json").read_text()


# --- 6. secret never returned by any API --------------------------------------

def test_secret_never_returned_by_api(stores):
    client = APIClient()
    created = client.post(
        "/api/mailbox/accounts/",
        data=json.dumps({"provider": "gmail", "display_name": "W", "email": "w@x.com"}),
        content_type="application/json",
    ).json()
    put = client.put(
        f"/api/mailbox/accounts/{created['id']}/credential/",
        data=json.dumps({"value": "API-SECRET-VALUE"}),
        content_type="application/json",
    )
    assert "API-SECRET-VALUE" not in json.dumps(put.json())
    listing = client.get("/api/mailbox/accounts/").json()
    assert "API-SECRET-VALUE" not in json.dumps(listing)
    assert listing["results"][0]["has_credential"] is True


# --- 7 & 8. out-of-scope host and path ----------------------------------------

def _permissions() -> dict:
    return yaml.safe_load((Path(settings.BASE_DIR) / "config" / "permissions.yaml").read_text())


def test_out_of_scope_host_blocked():
    net = _permissions()["network"]
    allowed = set(net["mailbox_imap_smtp"]["allow_hosts"]) | set(net["mailbox_graph"]["allow_hosts"])
    assert "mail.attacker.example" not in allowed


def test_out_of_scope_path_blocked():
    deny = set(_permissions()["filesystem"]["mailbox_config"]["deny"])
    assert {"config/**", "**/.env"} <= deny


# --- 9. Graph 403 -> permission_denied ----------------------------------------

def test_graph_403_is_permission_denied():
    with pytest.raises(PermissionDeniedError):
        m365.graph_tree(token="T", transport=lambda *a: (403, {"error": {"code": "Forbidden"}}))
