"""Stage 3 verification: the file-based JSON store and data preservation.

Every test points ``MANGO_CALENDAR_DATA_DIR`` at a throwaway directory, so the
real ``data/calendar/`` is never touched. The committed seed under
``utils/apps/calendar/backend/seed/`` is the source of truth that the original
Flask app's data is preserved byte-for-byte.
"""

from __future__ import annotations

import filecmp
import json
from pathlib import Path

import pytest

from utils.apps.calendar.backend.services import store

SEED_ROOT = Path(store._SEED_ROOT)


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    path = tmp_path / "calendar"
    monkeypatch.setenv("MANGO_CALENDAR_DATA_DIR", str(path))
    return path


def test_data_root_honours_env_override(data_dir):
    assert store.data_root() == data_dir


def test_seed_creates_all_files(data_dir):
    root = store.ensure_seeded()
    assert root == data_dir
    assert (data_dir / "calendar.json").is_file()
    assert (data_dir / "instructions.md").is_file()
    assert (data_dir / "schedules" / "spring_2026.json").is_file()
    assert (data_dir / "schedules" / "summer_2026.json").is_file()


def test_seeded_files_are_byte_identical_to_seed(data_dir):
    store.ensure_seeded()
    for rel in [
        "calendar.json",
        "instructions.md",
        "schedules/spring_2026.json",
        "schedules/summer_2026.json",
    ]:
        assert filecmp.cmp(SEED_ROOT / rel, data_dir / rel, shallow=False), rel


def test_preserved_calendar_content(data_dir):
    store.ensure_seeded()
    config = json.loads((data_dir / "calendar.json").read_text(encoding="utf-8"))
    # The original app's data: one schedule mapping, three direct events.
    assert len(config["entries"]) == 1
    assert config["entries"][0]["schedule_filename"] == "spring_2026.json"
    assert len(config["direct_events"]) == 3
    titles = {e["title"].strip() for e in config["direct_events"]}
    assert {"Physical Therapy", "Appointment Example"} <= titles


def test_preserved_schedule_content(data_dir):
    store.ensure_seeded()
    spring = json.loads(
        (data_dir / "schedules" / "spring_2026.json").read_text(encoding="utf-8")
    )
    assert "events" in spring and isinstance(spring["events"], list)
    assert spring["color_mappings"]["class"] == "purple"


def test_seed_is_non_destructive(data_dir):
    """An existing file is never overwritten by seeding."""
    data_dir.mkdir(parents=True, exist_ok=True)
    custom = {"entries": [], "direct_events": [{"date": "2030-01-01", "title": "Mine"}]}
    (data_dir / "calendar.json").write_text(json.dumps(custom), encoding="utf-8")
    # Force a re-seed against this root.
    store._seeded_roots.discard(str(data_dir))

    store.ensure_seeded()

    after = json.loads((data_dir / "calendar.json").read_text(encoding="utf-8"))
    assert after == custom  # untouched
    # but missing files were still filled in from seed
    assert (data_dir / "schedules" / "spring_2026.json").is_file()


def test_atomic_write_round_trips_and_leaves_no_temp(data_dir):
    store.ensure_seeded()
    target = data_dir / "calendar.json"
    payload = {"entries": [], "direct_events": []}
    store.write_json_atomic(target, payload)
    assert store.read_json(target) == payload
    # no stray temp files from the atomic write
    leftovers = [p.name for p in data_dir.iterdir() if p.name.startswith(".calendar.json")]
    assert leftovers == []
