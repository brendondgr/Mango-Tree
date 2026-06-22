"""Stage 2 verification: the local account *settings* store — CRUD, upsert,
multiple-per-provider, atomic write, validation, and the secret-leak guard.

The store is file-backed (``data/mailbox/accounts.json``); every test points
``MANGO_MAILBOX_CONFIG`` at a throwaway path, so the real config is never touched.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from utils.apps.mailbox.backend.services import config_store
from utils.apps.mailbox.shared.errors import NotFoundError, ValidationError


@pytest.fixture
def cfg_path(tmp_path, monkeypatch):
    path = tmp_path / "accounts.json"
    monkeypatch.setenv("MANGO_MAILBOX_CONFIG", str(path))
    return path


def test_empty_store_lists_nothing(cfg_path):
    assert config_store.list_accounts() == []


def test_create_generates_id_and_defaults(cfg_path):
    account = config_store.save_account(
        {"provider": "gmail", "display_name": "Work", "email": "w@x.com"}
    )
    assert account.id.startswith("acc_")
    assert account.enabled is True
    assert account.status == "untested"
    assert config_store.get_account(account.id).email == "w@x.com"


def test_multiple_accounts_per_provider(cfg_path):
    a = config_store.save_account({"provider": "gmail", "display_name": "Work", "email": "w@x.com"})
    b = config_store.save_account({"provider": "gmail", "display_name": "Home", "email": "h@x.com"})
    assert a.id != b.id
    assert len(config_store.list_accounts()) == 2


def test_upsert_on_id_does_not_duplicate(cfg_path):
    a = config_store.save_account({"provider": "yahoo", "display_name": "Y", "email": "y@x.com"})
    config_store.save_account({**a.to_dict(), "display_name": "Yahoo!"})
    accounts = config_store.list_accounts()
    assert len(accounts) == 1
    assert accounts[0].display_name == "Yahoo!"


def test_atomic_write_produces_valid_versioned_json(cfg_path):
    config_store.save_account({"provider": "gmail", "display_name": "W", "email": "w@x.com"})
    raw = json.loads(Path(cfg_path).read_text())
    assert raw["version"] == config_store.CONFIG_VERSION
    assert isinstance(raw["accounts"], list) and len(raw["accounts"]) == 1


def test_secret_keys_never_written_to_disk(cfg_path):
    config_store.save_account({
        "provider": "gmail", "display_name": "Work", "email": "w@x.com",
        "credential_ref": "MAIL_GMAIL_WORK",
        "access_token": "LEAKED-TOKEN", "password": "LEAKED-PW", "credential": "LEAKED",
    })
    disk = Path(cfg_path).read_text()
    assert "LEAKED-TOKEN" not in disk
    assert "LEAKED-PW" not in disk
    assert "LEAKED" not in disk
    # the credential_ref (a key name, not a secret) IS persisted
    assert "MAIL_GMAIL_WORK" in disk
    assert config_store.get_account(
        config_store.list_accounts()[0].id
    ).credential_ref == "MAIL_GMAIL_WORK"


@pytest.mark.parametrize(
    "payload",
    [
        {"provider": "aol", "display_name": "x", "email": "e@x.com"},      # bad provider
        {"provider": "gmail", "email": "e@x.com"},                          # missing display_name
        {"provider": "gmail", "display_name": "x"},                          # missing email
        {"provider": "exchange", "display_name": "Corp", "email": "e@corp.com"},  # missing host
    ],
)
def test_invalid_payloads_raise_validation_error(cfg_path, payload):
    with pytest.raises(ValidationError):
        config_store.save_account(payload)


def test_exchange_requires_host_but_accepts_one(cfg_path):
    account = config_store.save_account({
        "provider": "exchange", "display_name": "Corp", "email": "e@corp.com",
        "imap_host": "mail.corp.com",
    })
    assert account.imap_host == "mail.corp.com"


def test_set_status_updates_in_place(cfg_path):
    a = config_store.save_account({"provider": "gmail", "display_name": "W", "email": "w@x.com"})
    assert config_store.set_status(a.id, "ok").status == "ok"
    assert config_store.get_account(a.id).status == "ok"


def test_delete_then_missing_raises_not_found(cfg_path):
    a = config_store.save_account({"provider": "gmail", "display_name": "W", "email": "w@x.com"})
    config_store.delete_account(a.id)
    with pytest.raises(NotFoundError):
        config_store.get_account(a.id)
    with pytest.raises(NotFoundError):
        config_store.delete_account(a.id)
