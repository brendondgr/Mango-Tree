"""Account-id-aware mutation orchestration: organize / create folder / send.

Resolves an account id to a connection ``MailAccount`` via the provider registry,
then calls the IMAP/SMTP write cores in ``ops``. This is the single mutation
service that both the DRF views and the agent tools call (API <-> agent parity).

The irreversible ``send`` is *not* gated here — the confirm gate lives in the
agent tool layer (``agent/tools.py``), per the rule that enforcement is in code,
never in the prompt.
"""

from __future__ import annotations

from typing import Any, Callable

from utils.apps.mailbox.backend.services import ops as _ops
from utils.apps.mailbox.backend.services import providers as _providers
from utils.apps.mailbox.backend.services.ops import MailAccount


def _resolve(account_id: str, build: Callable[[str], MailAccount] | None) -> MailAccount:
    return (build or _providers.build_account)(account_id)


def organize(
    account_id: str,
    *,
    uid: str,
    dest: str,
    source: str = "INBOX",
    create_if_missing: bool = True,
    build=None,
    imap_factory=None,
) -> dict[str, Any]:
    return _ops.organize_message(
        _resolve(account_id, build),
        uid=uid,
        source_folder=source,
        dest_folder=dest,
        create_if_missing=create_if_missing,
        imap_factory=imap_factory,
    )


def create_folder(account_id: str, *, name: str, build=None, imap_factory=None) -> dict[str, Any]:
    account = _resolve(account_id, build)
    client = _ops.connect_imap(account, imap_factory=imap_factory)
    try:
        return _ops.create_folder(client, name)
    finally:
        _ops._safe_logout(client)


def send(
    account_id: str,
    *,
    to: list[str],
    subject: str,
    body: str,
    cc: list[str] | None = None,
    html: str | None = None,
    build=None,
    smtp_factory=None,
) -> dict[str, Any]:
    return _ops.send_message(
        _resolve(account_id, build),
        to=to,
        subject=subject,
        body=body,
        cc=cc,
        html=html,
        smtp_factory=smtp_factory,
    )
