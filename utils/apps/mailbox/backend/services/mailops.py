"""Account-id-aware mutation orchestration: organize / create folder / send.

Resolves an account id to a connection ``MailAccount`` via the provider registry,
then calls the IMAP/SMTP write cores in ``ops``. This is the single mutation
service that both the DRF views and the agent tools call (API <-> agent parity).

The irreversible ``send`` is *not* gated here — the confirm gate lives in the
agent tool layer (``agent/tools.py``), per the rule that enforcement is in code,
never in the prompt.
"""

from __future__ import annotations

import time
from typing import Any, Callable, Sequence

from utils.apps.mailbox.backend.services import cache as _cache
from utils.apps.mailbox.backend.services import ops as _ops
from utils.apps.mailbox.backend.services import providers as _providers
from utils.apps.mailbox.backend.services.ops import MailAccount
from utils.apps.mailbox.shared.errors import ValidationError


def _resolve(account_id: str, build: Callable[[str], MailAccount] | None) -> MailAccount:
    return (build or _providers.build_account)(account_id)


# --- D8: keep the local cache consistent after a mutation (best-effort) --------
# The next incremental sync is the source of truth; these just make a user-driven
# change show up immediately instead of on the next 10s poll. A cache miss must
# never fail the operation, so every helper swallows its own errors.

def _drop_cache_uids(account_id: str, folder: str, uids: Sequence[str]) -> None:
    """Remove UIDs from the folder cache (after a move/delete out of it)."""
    try:
        doc = _cache.load(account_id, folder)
        _cache.remove_uids(doc, {str(u) for u in uids})
        _cache.save(doc, now=time.time())
    except Exception:
        pass


def _apply_cache_flags(
    account_id: str, folder: str, uids: Sequence[str],
    add: Sequence[str], remove: Sequence[str],
) -> None:
    """Reflect a flag change on the cached messages (read/unread, star)."""
    try:
        doc = _cache.load(account_id, folder)
        changed = False
        for uid in uids:
            msg = doc["messages"].get(str(uid))
            if msg is None:
                continue
            flags = [f for f in msg.get("flags", []) if f not in remove]
            for f in add:
                if f not in flags:
                    flags.append(f)
            _cache.update_flags(doc, str(uid), flags)
            changed = True
        if changed:
            _cache.save(doc, now=time.time())
    except Exception:
        pass


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


def move(
    account_id: str,
    *,
    uids: Sequence[str],
    dest: str,
    source: str = "INBOX",
    create_if_missing: bool = True,
    build=None,
    imap_factory=None,
) -> dict[str, Any]:
    """Move a batch of messages, then drop them from the source-folder cache (D8)."""
    result = _ops.move_messages(
        _resolve(account_id, build),
        uids=uids,
        source_folder=source,
        dest_folder=dest,
        create_if_missing=create_if_missing,
        imap_factory=imap_factory,
    )
    _drop_cache_uids(account_id, source, result["uids"])
    return result


def mark(
    account_id: str,
    *,
    uids: Sequence[str],
    read: bool | None = None,
    starred: bool | None = None,
    source: str = "INBOX",
    build=None,
    imap_factory=None,
) -> dict[str, Any]:
    """Mark messages read/unread and/or starred/unstarred.

    ``read``/``starred`` are tri-state: ``True`` adds the flag, ``False`` removes
    it, ``None`` leaves it untouched. Reflects the change in the cache (D8).
    """
    add: list[str] = []
    remove: list[str] = []
    if read is True:
        add.append("\\Seen")
    elif read is False:
        remove.append("\\Seen")
    if starred is True:
        add.append("\\Flagged")
    elif starred is False:
        remove.append("\\Flagged")
    if not add and not remove:
        raise ValidationError(
            "nothing to change: set read and/or starred",
            details={"read": read, "starred": starred},
        )
    result = _ops.set_flags(
        _resolve(account_id, build),
        uids=uids,
        add=add,
        remove=remove,
        source_folder=source,
        imap_factory=imap_factory,
    )
    _apply_cache_flags(account_id, source, result["uids"], add, remove)
    return result


def delete(
    account_id: str,
    *,
    uids: Sequence[str],
    source: str = "INBOX",
    permanent: bool = False,
    build=None,
    imap_factory=None,
) -> dict[str, Any]:
    """Delete a batch of messages: soft (move to Trash, reversible) or permanent.

    Either way the messages leave the source folder, so they are dropped from its
    cache (D8). The confirm gate for the irreversible permanent path lives in the
    agent tool, not here — enforcement is in code, never in the prompt.
    """
    result = _ops.delete_message(
        _resolve(account_id, build),
        uids=uids,
        source_folder=source,
        permanent=permanent,
        imap_factory=imap_factory,
    )
    _drop_cache_uids(account_id, source, result["uids"])
    return result


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


def reply(
    account_id: str,
    *,
    uid: str,
    body: str,
    html: str | None = None,
    reply_all: bool = False,
    source: str = "INBOX",
    build=None,
    imap_factory=None,
    smtp_factory=None,
) -> dict[str, Any]:
    """Reply / reply-all to a message. The irreversible-send confirm gate lives in
    the agent tool; this orchestrator resolves the account and calls the core."""
    return _ops.reply_message(
        _resolve(account_id, build),
        uid=uid,
        body=body,
        html=html,
        reply_all=reply_all,
        source_folder=source,
        imap_factory=imap_factory,
        smtp_factory=smtp_factory,
    )
