"""Agent tools for the mailbox app.

Each tool calls the same ``backend/services/`` function as its matching DRF view
(API <-> agent parity), returns structured output via the :class:`ToolResult`
pattern, and confirm-gates the irreversible send. Services are injectable so the
tools are unit-testable without a live server.

Account scoping (D1): ``account`` is an account id resolved against the config
store by the registry; ``list_accounts`` returns only configured accounts.
Enforcement lives here in code, not in the prompt — ``send_message`` returns
``permission_denied`` unless ``confirm is True``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from utils.apps.mailbox.backend.services import config_store as _config_store
from utils.apps.mailbox.backend.services import mailops as _mailops
from utils.apps.mailbox.backend.services import messages as _messages
from utils.apps.mailbox.shared.errors import MailError


@dataclass(frozen=True)
class ToolResult:
    ok: bool
    data: dict[str, Any]
    error: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        if self.ok:
            return self.data
        return {"error": self.error or {"code": "internal_error", "message": "Tool failed"}}


def _error(exc: MailError) -> dict[str, Any]:
    return ToolResult(
        ok=False,
        data={},
        error={"code": exc.code, "message": exc.message, "details": exc.details},
    ).to_dict()


def _denied(message: str) -> dict[str, Any]:
    return ToolResult(
        ok=False,
        data={},
        error={"code": "permission_denied", "message": message, "details": {}},
    ).to_dict()


# --- reads --------------------------------------------------------------------

def list_accounts(*, service=None) -> dict[str, Any]:
    """Configured accounts the caller may act on (settings only, no secrets)."""
    svc = service or _config_store
    try:
        accounts = svc.list_accounts()
    except MailError as exc:
        return _error(exc)
    return {
        "accounts": [
            {
                "id": a.id,
                "provider": a.provider,
                "email": a.email,
                "display_name": a.display_name,
                "enabled": a.enabled,
            }
            for a in accounts
        ]
    }


def list_folders(*, account: str, service=None) -> dict[str, Any]:
    svc = service or _messages
    try:
        return svc.list_folders(account)
    except MailError as exc:
        return _error(exc)


def list_messages(*, account: str, folder: str = "INBOX", limit: int = 25, service=None) -> dict[str, Any]:
    svc = service or _messages
    try:
        items = svc.list_messages(account, folder=folder, limit=limit)
    except MailError as exc:
        return _error(exc)
    return {"messages": [m.to_dict() for m in items], "count": len(items)}


# --- mutating (reversible — not gated) ----------------------------------------

def organize_message(
    *,
    account: str,
    uid: str,
    dest: str,
    source: str = "INBOX",
    create_if_missing: bool = True,
    service=None,
) -> dict[str, Any]:
    svc = service or _mailops
    try:
        return svc.organize(
            account, uid=uid, dest=dest, source=source, create_if_missing=create_if_missing
        )
    except MailError as exc:
        return _error(exc)


def create_folder(*, account: str, name: str, service=None) -> dict[str, Any]:
    svc = service or _mailops
    try:
        return svc.create_folder(account, name=name)
    except MailError as exc:
        return _error(exc)


# --- irreversible (confirm-gated in code) -------------------------------------

def send_message(
    *,
    account: str,
    to: list[str],
    subject: str,
    body: str,
    cc: list[str] | None = None,
    html: str | None = None,
    confirm: bool = False,
    service=None,
) -> dict[str, Any]:
    """Send a message. Without ``confirm: true`` this returns ``permission_denied``
    by design — the gate is enforced here, not in the prompt."""
    if confirm is not True:
        return _denied("Sending a message requires confirm: true")
    svc = service or _mailops
    try:
        return svc.send(account, to=to, subject=subject, body=body, cc=cc, html=html)
    except MailError as exc:
        return _error(exc)
