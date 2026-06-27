"""Local message cache for the inbox (per account + folder).

Persists message *list metadata* (the fields the inbox list shows) keyed by IMAP
UID, plus bodies cached lazily when a message is opened, plus the folder's
``UIDVALIDITY`` so a server-side UID reset invalidates the cache. This is what
lets the inbox avoid re-downloading the whole folder on every load: a sync only
fetches UIDs not already cached (see ``sync.sync_folder``).

Files live under ``data/mailbox/cache/`` (override ``MANGO_MAILBOX_CACHE``), one
JSON per account+folder, written atomically. Bodies are not secrets, but the
cache directory is gitignored like the rest of ``data/mailbox/``.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

CACHE_VERSION = 1


# --- path resolution ----------------------------------------------------------

def _default_root() -> Path:
    try:
        from django.conf import settings

        if settings.configured:
            return Path(settings.BASE_DIR) / "data" / "mailbox"
    except Exception:
        pass
    # utils/apps/mailbox/backend/services/cache.py -> repo root is parents[5]
    return Path(__file__).resolve().parents[5] / "data" / "mailbox"


def cache_dir() -> Path:
    override = os.environ.get("MANGO_MAILBOX_CACHE")
    return Path(override) if override else _default_root() / "cache"


def _safe(name: str) -> str:
    """Filesystem-safe token for an account id / folder path."""
    return re.sub(r"[^A-Za-z0-9._-]", "_", name) or "_"


def cache_path(account_id: str, folder: str) -> Path:
    return cache_dir() / f"{_safe(account_id)}__{_safe(folder)}.json"


# --- doc shape ----------------------------------------------------------------

def _empty(account_id: str, folder: str) -> dict[str, Any]:
    return {
        "version": CACHE_VERSION,
        "account_id": account_id,
        "folder": folder,
        "uidvalidity": None,
        "updated_at": 0.0,
        "messages": {},  # uid -> list-metadata dict
        "bodies": {},     # uid -> {body_text, body_html}
    }


def load(account_id: str, folder: str) -> dict[str, Any]:
    path = cache_path(account_id, folder)
    if not path.exists():
        return _empty(account_id, folder)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _empty(account_id, folder)
    if not isinstance(data, dict) or not isinstance(data.get("messages"), dict):
        return _empty(account_id, folder)
    data.setdefault("bodies", {})
    data.setdefault("uidvalidity", None)
    return data


def save(doc: dict[str, Any], *, now: float) -> None:
    account_id = doc["account_id"]
    folder = doc["folder"]
    doc["updated_at"] = now
    path = cache_path(account_id, folder)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(doc, indent=0)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".cache.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(payload)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


# --- pure helpers (operate on a loaded doc) -----------------------------------

def cached_uids(doc: dict[str, Any]) -> set[str]:
    return set(doc["messages"].keys())


def upsert_message(doc: dict[str, Any], dto: dict[str, Any]) -> None:
    doc["messages"][str(dto["uid"])] = dto


def update_flags(doc: dict[str, Any], uid: str, flags: list[str]) -> None:
    msg = doc["messages"].get(str(uid))
    if msg is not None:
        msg["flags"] = flags
        msg["unread"] = "\\Seen" not in flags


def remove_uids(doc: dict[str, Any], uids: set[str]) -> None:
    for uid in uids:
        doc["messages"].pop(uid, None)
        doc["bodies"].pop(uid, None)


def reset_messages(doc: dict[str, Any], uidvalidity: int | None) -> None:
    doc["messages"] = {}
    doc["bodies"] = {}
    doc["uidvalidity"] = uidvalidity


def sorted_messages(doc: dict[str, Any], limit: int | None = None) -> list[dict[str, Any]]:
    """Cached messages, newest first (by parsed timestamp, then uid)."""
    items = list(doc["messages"].values())
    items.sort(key=lambda m: (m.get("timestamp", 0.0), _uid_int(m.get("uid"))), reverse=True)
    return items if limit is None else items[:limit]


def _uid_int(uid: Any) -> int:
    try:
        return int(uid)
    except (TypeError, ValueError):
        return 0


# --- body cache (lazy, on open) -----------------------------------------------

def get_body(account_id: str, folder: str, uid: str) -> dict[str, Any] | None:
    return load(account_id, folder)["bodies"].get(str(uid))


def set_body(account_id: str, folder: str, uid: str, *, body_text, body_html, now: float) -> None:
    doc = load(account_id, folder)
    doc["bodies"][str(uid)] = {"body_text": body_text, "body_html": body_html}
    save(doc, now=now)


# --- convenience --------------------------------------------------------------

def cached_list(account_id: str, folder: str, limit: int | None = None) -> list[dict[str, Any]]:
    return sorted_messages(load(account_id, folder), limit)


def stats(account_id: str, folder: str) -> dict[str, Any]:
    doc = load(account_id, folder)
    return {
        "count": len(doc["messages"]),
        "bodies": len(doc["bodies"]),
        "uidvalidity": doc.get("uidvalidity"),
        "updated_at": doc.get("updated_at", 0.0),
    }
