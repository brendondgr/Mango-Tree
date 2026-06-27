"""Background runner for incremental folder syncs + progress reporting.

A sync runs in a daemon thread so the HTTP request returns immediately; progress
(``processed``/``total``/``new``) is written to a small status file (see
``cache.write_status``) so any request/worker can read it. A per-process lock
prevents duplicate concurrent syncs for the same account+folder.

Single-process assumption: the in-memory running-set is per process. For local
dev (one ASGI/runserver worker) that's exactly right; under multiple workers the
status file is still shared, only the dedupe is per-process (a redundant sync is
harmless because it is incremental).
"""

from __future__ import annotations

import threading
import time
from typing import Any, Callable

from utils.apps.mailbox.backend.services import cache as _cache
from utils.apps.mailbox.backend.services import providers as _providers
from utils.apps.mailbox.backend.services import sync as _sync
from utils.apps.mailbox.backend.services.ops import MailAccount

_RUNNING: set[str] = set()
_LOCK = threading.Lock()

# A sync flagged "syncing" but not seen for this long is treated as finished
# (its process likely died mid-run), so the UI never sticks on a spinner.
_STALE_SECONDS = 120.0


def _key(account_id: str, folder: str) -> str:
    return f"{account_id}:{folder}"


def get_status(account_id: str, folder: str = "INBOX") -> dict[str, Any]:
    raw = _cache.read_status(account_id, folder)
    running = _key(account_id, folder) in _RUNNING
    state = raw.get("state", "idle")
    updated = float(raw.get("updated_at", 0.0) or 0.0)
    if state == "syncing" and not running and (time.time() - updated) > _STALE_SECONDS:
        state = "idle"
    return {
        "state": state,
        "processed": int(raw.get("processed", 0) or 0),
        "total": int(raw.get("total", 0) or 0),
        "new": int(raw.get("new", 0) or 0),
        "removed": int(raw.get("removed", 0) or 0),
        "error": raw.get("error"),
        "updated_at": updated,
    }


def _write(account_id: str, folder: str, **fields: Any) -> None:
    payload = {"updated_at": time.time(), **fields}
    _cache.write_status(account_id, folder, payload)


def start_sync(
    account_id: str,
    folder: str = "INBOX",
    *,
    build: Callable[[str], MailAccount] | None = None,
    imap_factory=None,
    runner: Callable[..., Any] | None = None,
) -> dict[str, Any]:
    """Begin (or no-op if already running) an incremental sync. Resolves the
    account and checks credentials synchronously so missing creds deny (403)
    immediately, then runs the sync in a background thread."""
    key = _key(account_id, folder)
    with _LOCK:
        if key in _RUNNING:
            return get_status(account_id, folder)
        _RUNNING.add(key)
    try:
        account = (build or _providers.build_account)(account_id)
        account.require_credentials()  # PermissionDeniedError -> 403 at the view
    except Exception:
        with _LOCK:
            _RUNNING.discard(key)
        raise

    _write(account_id, folder, state="syncing", processed=0, total=0, new=0, removed=0, error=None)
    target = runner or _run
    thread = threading.Thread(
        target=target, args=(account, account_id, folder), kwargs={"imap_factory": imap_factory}, daemon=True
    )
    thread.start()
    return get_status(account_id, folder)


def _run(account: MailAccount, account_id: str, folder: str, *, imap_factory=None) -> None:
    key = _key(account_id, folder)

    def progress(done: int, total: int) -> None:
        _write(account_id, folder, state="syncing", processed=done, total=total, new=total, removed=0, error=None)

    try:
        summary = _sync.sync_folder(
            account, account_id=account_id, folder=folder,
            imap_factory=imap_factory, on_progress=progress,
        )
        _write(
            account_id, folder, state="idle",
            processed=summary["new"], total=summary["new"],
            new=summary["new"], removed=summary["removed"], error=None,
        )
    except Exception as exc:  # noqa: BLE001 - surface any failure to the UI
        _write(account_id, folder, state="error", processed=0, total=0, new=0, removed=0, error=str(exc))
    finally:
        with _LOCK:
            _RUNNING.discard(key)
