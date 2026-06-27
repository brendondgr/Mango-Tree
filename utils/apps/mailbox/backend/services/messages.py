"""Account-id-aware read orchestration: folders + messages.

Resolves an account id to a connection ``MailAccount`` via the provider registry
(which reads the config store + secret store), then calls the IMAP read cores in
``ops``/``sync``. This is the single read service that both the DRF views and the
agent tools call (API <-> agent parity).

``build`` and ``imap_factory`` are injectable so the orchestration is unit-testable
without a live server or stored credentials.
"""

from __future__ import annotations

import time
from typing import Any, Callable

from utils.apps.mailbox.backend.services import cache as _cache
from utils.apps.mailbox.backend.services import ops as _ops
from utils.apps.mailbox.backend.services import providers as _providers
from utils.apps.mailbox.backend.services import sync as _sync
from utils.apps.mailbox.backend.services import syncrunner as _syncrunner
from utils.apps.mailbox.backend.services.ops import MailAccount
from utils.apps.mailbox.shared.schemas import MessageDTO


def _resolve(account_id: str, build: Callable[[str], MailAccount] | None) -> MailAccount:
    return (build or _providers.build_account)(account_id)


def list_folders(account_id: str, *, build=None, imap_factory=None) -> dict[str, Any]:
    return _ops.folder_tree(_resolve(account_id, build), imap_factory=imap_factory)


def list_messages(
    account_id: str, *, folder: str = "INBOX", limit: int | None = 25, build=None, imap_factory=None
) -> list[MessageDTO]:
    return _sync.list_messages(
        _resolve(account_id, build), folder=folder, limit=limit, imap_factory=imap_factory
    )


def cached_messages(
    account_id: str, *, folder: str = "INBOX", limit: int | None = None
) -> list[dict[str, Any]]:
    """The locally cached message list (newest first). No network; returns ``[]``
    until the first sync has populated the cache."""
    return _cache.cached_list(account_id, folder, limit)


def start_sync(account_id: str, *, folder: str = "INBOX", build=None) -> dict[str, Any]:
    """Kick a background incremental sync of ``folder`` into the cache."""
    return _syncrunner.start_sync(account_id, folder, build=build)


def sync_status(account_id: str, *, folder: str = "INBOX") -> dict[str, Any]:
    return _syncrunner.get_status(account_id, folder)


def get_message(
    account_id: str, *, uid: str, folder: str = "INBOX", build=None, imap_factory=None
) -> MessageDTO:
    """Open one message. Returns the cached body when available (instant
    re-open); otherwise fetches it over IMAP and caches the body."""
    doc = _cache.load(account_id, folder)
    meta = doc["messages"].get(str(uid))
    body = doc["bodies"].get(str(uid))
    if meta is not None and body is not None:
        return MessageDTO.from_dict({**meta, **body})

    dto = _sync.get_message(
        _resolve(account_id, build), uid=uid, folder=folder, imap_factory=imap_factory
    )
    _cache.set_body(
        account_id, folder, uid,
        body_text=dto.body_text, body_html=dto.body_html, now=time.time(),
    )
    return dto
