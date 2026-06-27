"""File-based JSON store for the calendar app.

The calendar app has no database. State lives in a small set of JSON files under
``data/calendar/`` (mirroring the mailbox file-store pattern):

* ``calendar.json``        — schedule-to-date entries + one-off direct events
* ``schedules/<name>.json`` — reusable weekly schedule templates
* ``instructions.md``      — LLM prompt describing the schedule schema

``data/`` is gitignored, so the original content is committed under
``backend/seed/`` and copied into the runtime directory on first access when it
is missing (non-destructive — an existing file is never overwritten). Writes are
atomic (``tempfile`` + ``os.replace``) so a crash mid-write cannot corrupt a file.

Path resolution order for the data root:

1. ``MANGO_CALENDAR_DATA_DIR`` environment override (used by tests).
2. ``settings.BASE_DIR / "data" / "calendar"`` when Django is configured.
3. ``<repo-root> / "data" / "calendar"`` fallback (``parents[5]`` of this file).
"""

from __future__ import annotations

import json
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

# Root of the committed seed copy: utils/apps/calendar/backend/seed/
_SEED_ROOT = Path(__file__).resolve().parents[1] / "seed"

# Roots already seeded in this process, keyed by absolute path string. Keyed
# (rather than a single bool) so tests pointing at different throwaway dirs each
# seed correctly.
_seeded_roots: set[str] = set()


def data_root() -> Path:
    """Return the directory holding the calendar data files."""
    override = os.environ.get("MANGO_CALENDAR_DATA_DIR")
    if override:
        return Path(override)
    try:
        from django.conf import settings

        if settings.configured:
            return Path(settings.BASE_DIR) / "data" / "calendar"
    except Exception:
        pass
    # utils/apps/calendar/backend/services/store.py -> parents[5] is the repo root
    return Path(__file__).resolve().parents[5] / "data" / "calendar"


def calendar_file() -> Path:
    return ensure_seeded() / "calendar.json"


def schedules_dir() -> Path:
    return ensure_seeded() / "schedules"


def instructions_file() -> Path:
    return ensure_seeded() / "instructions.md"


# --- Seeding -----------------------------------------------------------------

def _copy_missing(src: Path, dest: Path) -> None:
    if src.is_file() and not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)


def ensure_seeded() -> Path:
    """Copy the committed seed files into the data root when absent.

    Idempotent and non-destructive: only files that do not already exist are
    created. Returns the resolved data root.
    """
    root = data_root()
    key = str(root)
    if key in _seeded_roots:
        return root

    root.mkdir(parents=True, exist_ok=True)
    _copy_missing(_SEED_ROOT / "calendar.json", root / "calendar.json")
    _copy_missing(_SEED_ROOT / "instructions.md", root / "instructions.md")

    seed_schedules = _SEED_ROOT / "schedules"
    if seed_schedules.is_dir():
        (root / "schedules").mkdir(parents=True, exist_ok=True)
        for src in sorted(seed_schedules.glob("*.json")):
            _copy_missing(src, root / "schedules" / src.name)

    _seeded_roots.add(key)
    return root


# --- Atomic JSON IO ----------------------------------------------------------

def read_json(path: Path) -> Any:
    """Read and parse a JSON file."""
    return json.loads(path.read_text(encoding="utf-8"))


def write_json_atomic(path: Path, data: Any) -> None:
    """Write ``data`` as pretty JSON atomically (tempfile + os.replace)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=f".{path.name}.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
