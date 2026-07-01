"""Agent-tool verification: tools produce structured output, call the same
services as the API, deny state-changing calls without confirmation, and surface
typed errors. Mocked-service tests need no DB; integration tests use the
throwaway copy."""

from __future__ import annotations

import importlib
from pathlib import Path
from unittest.mock import MagicMock

import yaml
from django.conf import settings

from utils.apps.timekeeper.agent import tools
from utils.apps.timekeeper.shared.errors import NotFoundError, ValidationError
from utils.apps.timekeeper.shared.schemas import TimeLogDTO


def _dto(**kw) -> TimeLogDTO:
    base = dict(id=1, date="2026-01-01", start_time="00:00", duration=5)
    base.update(kw)
    return TimeLogDTO(**base)


# --- structured output + service delegation (mocked, no DB) -------------------

def test_list_logs_structured_output():
    mock = MagicMock()
    mock.list_logs.return_value = [_dto(category_id="c", subcategory_id="s")]
    payload = tools.list_logs(date="2026-01-01", service=mock)
    assert payload["logs"][0]["id"] == 1
    assert payload["logs"][0]["category_id"] == "c"
    mock.list_logs.assert_called_once_with(date="2026-01-01")


def test_daily_totals_structured_output():
    mock = MagicMock()
    mock.daily_totals.return_value = [{"date": "2026-01-01", "total_duration": 30}]
    payload = tools.daily_totals(service=mock)
    assert payload["days"][0]["total_duration"] == 30
    mock.daily_totals.assert_called_once_with()


def test_list_categories_structured_output():
    mock = MagicMock()
    mock.get_categories.return_value = [{"id": "cat", "name": "Work", "subcategories": []}]
    payload = tools.list_categories(service=mock)
    assert payload["categories"][0]["id"] == "cat"
    mock.get_categories.assert_called_once_with()


def test_save_day_delegates_when_confirmed():
    mock = MagicMock()
    mock.save_day.return_value = [_dto(duration=10)]
    payload = tools.save_day(
        date="2026-01-01",
        intervals=[{"index": 0}, {"index": 1}],
        confirm=True,
        service=mock,
    )
    assert payload["saved"] == 1
    assert payload["logs"][0]["duration"] == 10
    mock.save_day.assert_called_once()


def test_delete_log_delegates_when_confirmed():
    mock = MagicMock()
    payload = tools.delete_log(log_id=5, confirm=True, service=mock)
    assert payload == {"deleted": True, "log_id": 5}
    mock.delete_log.assert_called_once_with(5)


# --- confirmation denials (service NOT called) --------------------------------

def test_save_day_denied_without_confirm():
    mock = MagicMock()
    payload = tools.save_day(date="2026-01-01", intervals=[{"index": 0}], service=mock)
    assert payload["error"]["code"] == "permission_denied"
    mock.save_day.assert_not_called()


def test_delete_log_denied_without_confirm():
    mock = MagicMock()
    payload = tools.delete_log(log_id=5, service=mock)
    assert payload["error"]["code"] == "permission_denied"
    mock.delete_log.assert_not_called()


# --- typed error surfacing ----------------------------------------------------

def test_save_day_surfaces_validation_error():
    mock = MagicMock()
    mock.save_day.side_effect = ValidationError("bad date", details={"field": "date"})
    payload = tools.save_day(date="nope", intervals=[], confirm=True, service=mock)
    assert payload["error"]["code"] == "validation_error"


def test_delete_log_surfaces_not_found():
    mock = MagicMock()
    mock.delete_log.side_effect = NotFoundError("Log 9 not found", details={"id": 9})
    payload = tools.delete_log(log_id=9, confirm=True, service=mock)
    assert payload["error"]["code"] == "not_found"


# --- registry manifest consistency --------------------------------------------

def test_tools_yaml_entries_resolve():
    config = yaml.safe_load(
        (Path(settings.BASE_DIR) / "config" / "tools.yaml").read_text()
    )
    tk_tools = {
        name: meta
        for name, meta in config["tools"].items()
        if meta.get("app") == "timekeeper"
    }
    assert len(tk_tools) == 5
    for meta in tk_tools.values():
        module = importlib.import_module(meta["module"])
        assert callable(getattr(module, meta["function"]))


# --- integration against the throwaway DB copy --------------------------------

def test_list_logs_integration():
    payload = tools.list_logs()
    assert payload["logs"]
    assert "start_time" in payload["logs"][0]


def test_daily_totals_integration():
    payload = tools.daily_totals()
    assert payload["days"]
    assert {"date", "total_duration"} <= set(payload["days"][0])


def test_list_categories_integration():
    payload = tools.list_categories()
    assert isinstance(payload["categories"], list)
    assert payload["categories"]


def test_save_day_then_delete_integration():
    saved = tools.save_day(
        date="2018-01-01",
        intervals=[{"index": 0, "category_id": "c", "subcategory_id": "s"}],
        confirm=True,
    )
    assert saved["saved"] == 1
    log_id = saved["logs"][0]["id"]
    deleted = tools.delete_log(log_id=log_id, confirm=True)
    assert deleted["deleted"] is True
    assert tools.list_logs(date="2018-01-01")["logs"] == []
