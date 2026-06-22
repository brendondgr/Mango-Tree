"""Stage 3 verification: the secret store keyed by ``credential_ref``.

Round-trips by ref, file is ``0600``, a missing ref denies, and the value is
never written into the account config file.
"""

from __future__ import annotations

import os
import stat
from pathlib import Path

import pytest

from utils.apps.mailbox.backend.services import config_store, secrets
from utils.apps.mailbox.shared.errors import PermissionDeniedError, ValidationError


@pytest.fixture
def stores(tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_MAILBOX_SECRETS", str(tmp_path / "secrets.json"))
    monkeypatch.setenv("MANGO_MAILBOX_CONFIG", str(tmp_path / "accounts.json"))
    return tmp_path


def test_round_trip_by_ref(stores):
    secrets.set_credential("MAIL_GMAIL_WORK", "tok-123")
    assert secrets.get_credential("MAIL_GMAIL_WORK") == "tok-123"
    assert secrets.has_credential("MAIL_GMAIL_WORK") is True
    assert secrets.has_credential("nope") is False
    assert secrets.has_credential(None) is False


def test_secrets_file_is_0600(stores):
    secrets.set_credential("REF", "value")
    mode = stat.S_IMODE(os.stat(secrets.secrets_path()).st_mode)
    assert mode == 0o600, oct(mode)


def test_missing_ref_denies(stores):
    with pytest.raises(PermissionDeniedError):
        secrets.get_credential("MISSING")
    with pytest.raises(PermissionDeniedError):
        secrets.get_credential("")


def test_empty_inputs_validation_error(stores):
    with pytest.raises(ValidationError):
        secrets.set_credential("", "value")
    with pytest.raises(ValidationError):
        secrets.set_credential("REF", "")


def test_delete_is_idempotent(stores):
    secrets.set_credential("REF", "value")
    secrets.delete_credential("REF")
    secrets.delete_credential("REF")  # no error
    assert secrets.has_credential("REF") is False


def test_secret_value_never_appears_in_accounts_file(stores):
    account = config_store.save_account(
        {"provider": "gmail", "display_name": "Work", "email": "w@x.com",
         "credential_ref": "MAIL_GMAIL_WORK"}
    )
    secrets.set_credential(account.credential_ref, "SUPER-SECRET-TOKEN")
    accounts_disk = Path(stores / "accounts.json").read_text()
    assert "SUPER-SECRET-TOKEN" not in accounts_disk
    # it lives only in the secrets file
    assert "SUPER-SECRET-TOKEN" in Path(secrets.secrets_path()).read_text()
