"""Credential store, keyed by ``credential_ref``.

Credentials (OAuth tokens / app passwords) live here, separate from the account
*settings* in ``config_store``. The config layer only ever stores the
``credential_ref`` key name; the raw value never enters ``accounts.json``.

Backend (Decision D5): a local ``0600`` JSON file at ``data/mailbox/secrets.json``
(override ``MANGO_MAILBOX_SECRETS``). The interface is deliberately small
(``set`` / ``get`` / ``delete`` / ``has``) so it can later swap to an OS keychain
or external secret manager without touching callers.
"""

from __future__ import annotations

import json
import os
import stat
import tempfile
from pathlib import Path
from typing import Any

from utils.apps.mailbox.shared.errors import PermissionDeniedError, ValidationError

SECRETS_VERSION = 1
_FILE_MODE = 0o600
_DIR_MODE = 0o700


def _default_root() -> Path:
    try:
        from django.conf import settings

        if settings.configured:
            return Path(settings.BASE_DIR) / "data" / "mailbox"
    except Exception:
        pass
    return Path(__file__).resolve().parents[5] / "data" / "mailbox"


def secrets_path() -> Path:
    override = os.environ.get("MANGO_MAILBOX_SECRETS")
    return Path(override) if override else _default_root() / "secrets.json"


def _read_raw() -> dict[str, Any]:
    path = secrets_path()
    if not path.exists():
        return {"version": SECRETS_VERSION, "secrets": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"version": SECRETS_VERSION, "secrets": {}}
    if not isinstance(data, dict) or not isinstance(data.get("secrets"), dict):
        return {"version": SECRETS_VERSION, "secrets": {}}
    return data


def _write_raw(secrets: dict[str, Any]) -> None:
    path = secrets_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(path.parent, _DIR_MODE)
    except OSError:
        pass
    payload = json.dumps({"version": SECRETS_VERSION, "secrets": secrets}, indent=2)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".secrets.", suffix=".tmp")
    try:
        os.fchmod(fd, _FILE_MODE)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(payload)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    try:
        os.chmod(path, _FILE_MODE)
    except OSError:
        pass


# --- public API ---------------------------------------------------------------

def set_credential(ref: str, value: str | dict[str, Any]) -> None:
    """Store ``value`` under the ``ref`` key name (write-only — never echoed).

    ``value`` is either a plain app-password string, or an OAuth bundle dict
    (``refresh_token`` / ``client_id`` / ``client_secret`` plus a cached
    ``access_token`` / ``access_token_expiry``)."""
    if not isinstance(ref, str) or not ref.strip():
        raise ValidationError("credential_ref is required", details={"field": "credential_ref"})
    if not isinstance(value, (str, dict)) or not value:
        raise ValidationError("credential value is required", details={"field": "credential"})
    raw = _read_raw()
    raw["secrets"][ref] = value
    _write_raw(raw["secrets"])


def get_credential(ref: str) -> str | dict[str, Any]:
    """Resolve ``ref`` -> the raw secret (string app-password or OAuth bundle dict).
    Raises ``permission_denied`` when the ref is unset (account not configured)."""
    if not ref:
        raise PermissionDeniedError("no credential_ref supplied", details={"missing": "credential_ref"})
    value = _read_raw()["secrets"].get(ref)
    if value is None:
        raise PermissionDeniedError(
            f"no credential stored for '{ref}'",
            details={"missing": "credential", "credential_ref": ref},
        )
    return value


def has_credential(ref: str | None) -> bool:
    """Whether a credential exists for ``ref`` (no value exposed)."""
    if not ref:
        return False
    return ref in _read_raw()["secrets"]


def delete_credential(ref: str) -> None:
    """Remove the credential for ``ref`` (idempotent)."""
    raw = _read_raw()
    if ref in raw["secrets"]:
        del raw["secrets"][ref]
        _write_raw(raw["secrets"])


# --- self-test ----------------------------------------------------------------

def _selftest() -> None:
    import tempfile as _tf

    with _tf.TemporaryDirectory() as tmp:
        os.environ["MANGO_MAILBOX_SECRETS"] = str(Path(tmp) / "secrets.json")
        try:
            assert has_credential("X") is False
            set_credential("MAIL_GMAIL_WORK", "tok-123")
            assert get_credential("MAIL_GMAIL_WORK") == "tok-123"
            assert has_credential("MAIL_GMAIL_WORK") is True

            # file is 0600
            mode = stat.S_IMODE(os.stat(secrets_path()).st_mode)
            assert mode == _FILE_MODE, oct(mode)

            # missing ref -> permission_denied
            try:
                get_credential("MISSING")
                raise AssertionError("expected PermissionDeniedError")
            except PermissionDeniedError as exc:
                assert exc.details["missing"] == "credential"

            # delete is idempotent
            delete_credential("MAIL_GMAIL_WORK")
            delete_credential("MAIL_GMAIL_WORK")
            assert has_credential("MAIL_GMAIL_WORK") is False

            print("mailbox secrets selftest OK — all assertions passed")
        finally:
            os.environ.pop("MANGO_MAILBOX_SECRETS", None)


if __name__ == "__main__":
    _selftest()
