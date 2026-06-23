"""Pending-auth store: maps a one-time ``state`` -> the flow context
(``provider`` / ``verifier`` / ``redirect_uri``) while the user is on the
provider's portal. Entries have a TTL and are single-use (deleted on read).

The default is a ``0600`` JSON file under ``data/mailbox/`` (local-first, survives
across the start/callback requests). ``MemoryPendingStore`` is for tests.
"""

from __future__ import annotations

import json
import os
import tempfile
import time
from pathlib import Path
from typing import Any, Callable

_FILE_MODE = 0o600
_DIR_MODE = 0o700


def _default_root() -> Path:
    try:
        from django.conf import settings

        if settings.configured:
            return Path(settings.BASE_DIR) / "data" / "mailbox"
    except Exception:
        pass
    return Path(__file__).resolve().parents[6] / "data" / "mailbox"


class FilePendingStore:
    def __init__(self, path: str | os.PathLike | None = None, *, now: Callable[[], float] | None = None):
        self._path = Path(path) if path else None
        self._now = now or time.time

    def _file(self) -> Path:
        return self._path if self._path else _default_root() / "pending_oauth.json"

    def _read(self) -> dict[str, Any]:
        path = self._file()
        if not path.exists():
            return {}
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
        return data if isinstance(data, dict) else {}

    def _write(self, store: dict[str, Any]) -> None:
        path = self._file()
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.chmod(path.parent, _DIR_MODE)
        except OSError:
            pass
        fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".pending.", suffix=".tmp")
        try:
            os.fchmod(fd, _FILE_MODE)
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(json.dumps(store))
            os.replace(tmp, path)
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)

    def put(self, state: str, data: dict[str, Any], ttl_seconds: int) -> None:
        store = self._prune(self._read())
        store[state] = {**data, "_expires": self._now() + ttl_seconds}
        self._write(store)

    def take(self, state: str) -> dict[str, Any] | None:
        store = self._read()
        entry = store.pop(state, None)
        self._write(self._prune(store))
        if not entry or entry.get("_expires", 0) <= self._now():
            return None
        entry.pop("_expires", None)
        return entry

    def _prune(self, store: dict[str, Any]) -> dict[str, Any]:
        now = self._now()
        return {k: v for k, v in store.items() if v.get("_expires", 0) > now}


class MemoryPendingStore:
    def __init__(self, *, now: Callable[[], float] | None = None):
        self._store: dict[str, Any] = {}
        self._now = now or time.time

    def put(self, state: str, data: dict[str, Any], ttl_seconds: int) -> None:
        self._store[state] = {**data, "_expires": self._now() + ttl_seconds}

    def take(self, state: str) -> dict[str, Any] | None:
        entry = self._store.pop(state, None)
        if not entry or entry.get("_expires", 0) <= self._now():
            return None
        entry.pop("_expires", None)
        return entry
