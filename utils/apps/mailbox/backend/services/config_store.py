"""Local-file account *settings* store.

Persists account configuration (NOT secrets) to ``data/mailbox/accounts.json``.
Override the path with ``MANGO_MAILBOX_CONFIG``. Writes are atomic (temp file +
``os.replace``) and upsert on ``id``. Multiple accounts and multiple accounts per
provider are supported.

Secret-leak guard: ``save_account`` strips any secret-shaped keys before
validating/persisting, and only ``AccountConfig`` fields are ever written — so a
credential sent by mistake can never land in the config file. The actual
token/app-password lives in the separate secret store (``secrets.py``), referenced
by ``credential_ref`` (a key name).
"""

from __future__ import annotations

import json
import os
import tempfile
import uuid
from pathlib import Path
from typing import Any

from utils.apps.mailbox.shared.errors import NotFoundError, ValidationError
from utils.apps.mailbox.shared.schemas import SECRET_KEYS, AccountConfig

CONFIG_VERSION = 1


# --- path resolution ----------------------------------------------------------

def _default_root() -> Path:
    try:
        from django.conf import settings

        if settings.configured:
            return Path(settings.BASE_DIR) / "data" / "mailbox"
    except Exception:
        pass
    # utils/apps/mailbox/backend/services/config_store.py -> repo root is parents[5]
    return Path(__file__).resolve().parents[5] / "data" / "mailbox"


def config_path() -> Path:
    override = os.environ.get("MANGO_MAILBOX_CONFIG")
    return Path(override) if override else _default_root() / "accounts.json"


# --- raw file io --------------------------------------------------------------

def _read_raw() -> dict[str, Any]:
    path = config_path()
    if not path.exists():
        return {"version": CONFIG_VERSION, "accounts": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        raise ValidationError(
            "accounts.json is unreadable or corrupt",
            details={"path": str(path), "error": str(exc)},
        ) from exc
    if not isinstance(data, dict) or not isinstance(data.get("accounts"), list):
        raise ValidationError("accounts.json has an unexpected shape", details={"path": str(path)})
    return data


def _write_raw(accounts: list[dict[str, Any]]) -> None:
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps({"version": CONFIG_VERSION, "accounts": accounts}, indent=2)
    # atomic: write to a sibling temp file, then replace
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".accounts.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(payload)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def _strip_secret_keys(data: dict[str, Any]) -> dict[str, Any]:
    """Drop any secret-shaped key (defensive). ``credential_ref`` is a key name,
    not a secret, and is preserved."""
    return {k: v for k, v in data.items() if k not in SECRET_KEYS}


# --- public API ---------------------------------------------------------------

def list_accounts() -> list[AccountConfig]:
    return [AccountConfig.from_dict(a) for a in _read_raw()["accounts"]]


def get_account(account_id: str) -> AccountConfig:
    for account in _read_raw()["accounts"]:
        if account.get("id") == account_id:
            return AccountConfig.from_dict(account)
    raise NotFoundError(f"account '{account_id}' not found", details={"id": account_id})


def save_account(data: dict[str, Any] | AccountConfig) -> AccountConfig:
    """Create or update an account (upsert on ``id``). Generates an id when the
    payload omits one. Strips secret-shaped keys before persisting."""
    if isinstance(data, AccountConfig):
        payload = data.to_dict()
    else:
        if not isinstance(data, dict):
            raise ValidationError("account must be a JSON object")
        payload = _strip_secret_keys(dict(data))

    if not payload.get("id"):
        payload["id"] = "acc_" + uuid.uuid4().hex[:12]

    account = AccountConfig.from_dict(payload)  # validates provider/name/host/...

    raw = _read_raw()
    accounts = raw["accounts"]
    for index, existing in enumerate(accounts):
        if existing.get("id") == account.id:
            accounts[index] = account.to_dict()
            break
    else:
        accounts.append(account.to_dict())
    _write_raw(accounts)
    return account


def delete_account(account_id: str) -> None:
    raw = _read_raw()
    remaining = [a for a in raw["accounts"] if a.get("id") != account_id]
    if len(remaining) == len(raw["accounts"]):
        raise NotFoundError(f"account '{account_id}' not found", details={"id": account_id})
    _write_raw(remaining)


def set_status(account_id: str, status: str) -> AccountConfig:
    account = get_account(account_id)
    updated = AccountConfig.from_dict({**account.to_dict(), "status": status})
    return save_account(updated)


# --- self-test (no network; uses a throwaway config file) ---------------------

def _selftest() -> None:
    import tempfile as _tf

    from utils.apps.mailbox.shared.errors import MailError

    with _tf.TemporaryDirectory() as tmp:
        os.environ["MANGO_MAILBOX_CONFIG"] = str(Path(tmp) / "accounts.json")
        try:
            assert list_accounts() == []

            # create (id generated), then multiple-per-provider
            a = save_account({"provider": "gmail", "display_name": "Work", "email": "w@x.com"})
            assert a.id and a.status == "untested"
            b = save_account({"provider": "gmail", "display_name": "Personal", "email": "p@x.com"})
            assert len({a.id, b.id}) == 2
            assert len(list_accounts()) == 2

            # upsert on id
            updated = save_account({**a.to_dict(), "display_name": "Work (updated)"})
            assert updated.id == a.id
            assert get_account(a.id).display_name == "Work (updated)"
            assert len(list_accounts()) == 2  # not duplicated

            # secret-leak guard: a stray secret key never reaches disk
            save_account({
                "id": a.id, "provider": "gmail", "display_name": "Work", "email": "w@x.com",
                "credential_ref": "MAIL_GMAIL_WORK",
                "access_token": "SHOULD-NOT-PERSIST", "password": "nope",
            })
            disk = Path(os.environ["MANGO_MAILBOX_CONFIG"]).read_text()
            assert "SHOULD-NOT-PERSIST" not in disk and "nope" not in disk, disk
            assert "MAIL_GMAIL_WORK" in disk  # the ref (a key name) is fine

            # status update
            assert set_status(a.id, "ok").status == "ok"

            # validation: bad provider / missing name / missing exchange host
            for bad in (
                {"provider": "aol", "display_name": "x", "email": "e@x.com"},
                {"provider": "gmail", "email": "e@x.com"},  # no display_name
                {"provider": "exchange", "display_name": "Corp", "email": "e@corp.com"},  # no host
            ):
                try:
                    save_account(bad)
                    raise AssertionError(f"expected validation_error for {bad}")
                except MailError as exc:
                    assert exc.code == "validation_error", exc.code

            # exchange with host is accepted
            ex = save_account({
                "provider": "exchange", "display_name": "Corp", "email": "e@corp.com",
                "imap_host": "mail.corp.com",
            })
            assert ex.imap_host == "mail.corp.com"

            # delete
            delete_account(a.id)
            try:
                get_account(a.id)
                raise AssertionError("expected NotFoundError")
            except MailError as exc:
                assert exc.code == "not_found"

            print("mailbox config_store selftest OK — all assertions passed")
        finally:
            os.environ.pop("MANGO_MAILBOX_CONFIG", None)


if __name__ == "__main__":
    _selftest()
