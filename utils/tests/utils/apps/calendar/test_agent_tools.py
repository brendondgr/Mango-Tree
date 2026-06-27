"""Stage 6 verification: the curated calendar agent tools.

Asserts structured output, service injection, typed-error envelopes, the
confirm gate on destructive tools, and that every registered tool resolves to a
callable. Reads run against a throwaway seeded data dir.
"""

from __future__ import annotations

import importlib
from pathlib import Path

import pytest
import yaml
from django.conf import settings

from utils.apps.calendar.agent import tools
from utils.apps.calendar.shared.errors import NotFoundError


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_CALENDAR_DATA_DIR", str(tmp_path / "calendar"))
    return tmp_path


# --- structured output (real services) ---------------------------------------

def test_list_schedules_structured(data_dir):
    out = tools.list_schedules()
    assert "spring_2026.json" in out["schedules"]
    assert out["count"] >= 2


def test_get_day_structured(data_dir):
    out = tools.get_day(date="2026-01-23")
    assert out["schedule_filename"] == "spring_2026.json"
    assert "events" in out and "colors" in out


def test_find_free_slots_structured(data_dir):
    out = tools.find_free_slots(date="2026-01-23")
    assert "free_slots" in out


# --- service injection + error envelope --------------------------------------

class _Boom:
    def day_view(self, date):
        raise NotFoundError("nope", details={"x": 1})


def test_error_mapped_to_envelope():
    out = tools.get_day(date="x", service=_Boom())
    assert out["error"]["code"] == "not_found"
    assert out["error"]["details"] == {"x": 1}


class _Spy:
    def __init__(self):
        self.called = None

    def add_direct_event(self, payload):
        self.called = payload
        return 7


def test_service_injection_used():
    spy = _Spy()
    out = tools.add_direct_event(
        date="2026-01-01", title="x", start="09:00", end="10:00", service=spy
    )
    assert out == {"added": True, "index": 7}
    assert spy.called["type"] == "other"  # default applied by the tool
    assert "sub" not in spy.called         # absent sub stays absent


# --- confirm gates (denial) --------------------------------------------------

def test_delete_direct_event_requires_confirm():
    out = tools.delete_direct_event(index=0)
    assert out["error"]["code"] == "permission_denied"


def test_delete_entry_requires_confirm():
    assert tools.delete_entry(index=0)["error"]["code"] == "permission_denied"


def test_delete_by_title_requires_confirm():
    out = tools.delete_event_by_title(date="2026-01-01", title="x")
    assert out["error"]["code"] == "permission_denied"


def test_delete_with_confirm_calls_service(data_dir):
    idx = tools.add_direct_event(
        date="2026-01-01", title="Temp", start="09:00", end="10:00"
    )["index"]
    out = tools.delete_direct_event(index=idx, confirm=True)
    assert out == {"deleted": True, "index": idx}


def test_add_invalid_returns_validation(data_dir):
    out = tools.add_direct_event(date="2026-01-01", title="x", start="10:00", end="09:00")
    assert out["error"]["code"] == "validation_error"


# --- registry ----------------------------------------------------------------

def test_all_calendar_tools_registered_and_resolve():
    registry = yaml.safe_load(
        (Path(settings.BASE_DIR) / "config" / "tools.yaml").read_text()
    )["tools"]
    calendar_tools = {k: v for k, v in registry.items() if v["app"] == "calendar"}
    assert len(calendar_tools) == 12
    for name, entry in calendar_tools.items():
        module = importlib.import_module(entry["module"])
        fn = getattr(module, entry["function"])
        assert callable(fn), name
