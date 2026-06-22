"""Account-id-aware read orchestration: folders + messages.

Resolves an account id to a connection ``MailAccount`` via the provider registry
(which reads the config store + secret store), then calls the IMAP read cores in
``ops``/``sync``. This is the single read service that both the DRF views and the
agent tools call (API <-> agent parity).

``build`` and ``imap_factory`` are injectable so the orchestration is unit-testable
without a live server or stored credentials.
"""

from __future__ import annotations

from typing import Any, Callable

from utils.apps.mailbox.backend.services import ops as _ops
from utils.apps.mailbox.backend.services import providers as _providers
from utils.apps.mailbox.backend.services import sync as _sync
from utils.apps.mailbox.backend.services.ops import MailAccount
from utils.apps.mailbox.shared.schemas import MessageDTO


def _resolve(account_id: str, build: Callable[[str], MailAccount] | None) -> MailAccount:
    return (build or _providers.build_account)(account_id)


def list_folders(account_id: str, *, build=None, imap_factory=None) -> dict[str, Any]:
    return _ops.folder_tree(_resolve(account_id, build), imap_factory=imap_factory)


def list_messages(
    account_id: str, *, folder: str = "INBOX", limit: int = 25, build=None, imap_factory=None
) -> list[MessageDTO]:
    return _sync.list_messages(
        _resolve(account_id, build), folder=folder, limit=limit, imap_factory=imap_factory
    )


def get_message(
    account_id: str, *, uid: str, folder: str = "INBOX", build=None, imap_factory=None
) -> MessageDTO:
    return _sync.get_message(
        _resolve(account_id, build), uid=uid, folder=folder, imap_factory=imap_factory
    )
