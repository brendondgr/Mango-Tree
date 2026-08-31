"""Data-preservation test: the legacy TimeKeeper SQLite rows read back unchanged
through the managed=False models (Strategy A). Runs against a per-test throwaway
copy of the real database (root ``timekeeper_db`` fixture)."""

from __future__ import annotations

import json
import sqlite3

import pytest

from utils.apps.timekeeper.backend.models import Setting, TimeLog


def _raw_counts(db_path) -> tuple[int, int]:
    conn = sqlite3.connect(str(db_path))
    try:
        logs = conn.execute("SELECT COUNT(*) FROM time_logs").fetchone()[0]
        settings = conn.execute("SELECT COUNT(*) FROM settings").fetchone()[0]
    finally:
        conn.close()
    return logs, settings


@pytest.mark.needs_legacy_data
def test_time_log_count_matches_legacy(timekeeper_db):
    raw_logs, _ = _raw_counts(timekeeper_db)
    assert raw_logs > 0
    assert TimeLog.objects.count() == raw_logs


def test_settings_count_matches_legacy(timekeeper_db):
    _, raw_settings = _raw_counts(timekeeper_db)
    assert Setting.objects.count() == raw_settings


@pytest.mark.needs_legacy_data
def test_time_log_fields_read_back(timekeeper_db):
    """Spot-check a row read through the model against the raw SQLite row."""
    conn = sqlite3.connect(str(timekeeper_db))
    conn.row_factory = sqlite3.Row
    try:
        raw = conn.execute(
            "SELECT * FROM time_logs ORDER BY id ASC LIMIT 1"
        ).fetchone()
    finally:
        conn.close()

    row = TimeLog.objects.get(id=raw["id"])
    assert row.date == raw["date"]
    assert row.start_time == raw["start_time"]
    assert row.duration == raw["duration"]
    assert row.category_id == raw["category_id"]
    assert row.subcategory_id == raw["subcategory_id"]


@pytest.mark.needs_legacy_data
def test_categories_setting_is_valid_json(timekeeper_db):
    """The ``categories`` settings row holds a well-formed taxonomy."""
    setting = Setting.objects.get(pk="categories")
    parsed = json.loads(setting.value)
    assert isinstance(parsed, list)
    assert parsed, "expected at least one category"
    first = parsed[0]
    assert "id" in first and "name" in first
    assert "subcategories" in first


def test_reads_go_to_timekeeper_connection():
    """The router pins the models to the ``timekeeper`` alias, never default."""
    from utils.apps.timekeeper.backend.db_router import TimekeeperRouter

    router = TimekeeperRouter()
    assert router.db_for_read(TimeLog) == "timekeeper"
    assert router.db_for_write(Setting) == "timekeeper"
