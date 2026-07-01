"""Service-layer tests for timekeeper (logs + categories), including validation
and not-found denials. Bound to a throwaway DB copy via the autouse fixture."""

from __future__ import annotations

import json

import pytest

from utils.apps.timekeeper.backend.models import Setting, TimeLog
from utils.apps.timekeeper.backend.services import categories as categories_service
from utils.apps.timekeeper.backend.services import logs as logs_service
from utils.apps.timekeeper.shared.errors import NotFoundError, ValidationError


# --- list / stats -------------------------------------------------------------

def test_list_logs_returns_all():
    dtos = logs_service.list_logs()
    assert len(dtos) == TimeLog.objects.count()
    # newest date first
    dates = [d.date for d in dtos]
    assert dates == sorted(dates, reverse=True) or len(set(dates)) == 1


def test_list_logs_by_date_filters_and_orders():
    some_date = TimeLog.objects.values_list("date", flat=True).first()
    dtos = logs_service.list_logs(date=some_date)
    assert dtos, "expected logs for a known date"
    assert all(d.date == some_date for d in dtos)
    starts = [d.start_time for d in dtos]
    assert starts == sorted(starts)


def test_list_logs_bad_date_raises():
    with pytest.raises(ValidationError):
        logs_service.list_logs(date="not-a-date")


def test_daily_totals_sum_matches_raw():
    totals = logs_service.daily_totals()
    assert totals
    from django.db.models import Sum

    for entry in totals:
        raw = (
            TimeLog.objects.filter(date=entry["date"]).aggregate(s=Sum("duration"))["s"]
            or 0
        )
        assert entry["total_duration"] == raw


# --- save_day (replace semantics) --------------------------------------------

def test_save_day_groups_contiguous_blocks():
    date = "2020-01-01"
    intervals = [
        {"index": 0, "category_id": "c", "subcategory_id": "s"},
        {"index": 1, "category_id": "c", "subcategory_id": "s"},
        {"index": 3, "category_id": "c", "subcategory_id": "s"},
    ]
    result = logs_service.save_day(date, intervals)
    assert len(result) == 2  # 0-1 merged, 3 separate
    assert result[0].start_time == "00:00" and result[0].duration == 10
    assert result[1].start_time == "00:15" and result[1].duration == 5
    # persisted
    assert TimeLog.objects.filter(date=date).count() == 2


def test_save_day_overwrites_existing_day():
    date = "2020-02-02"
    logs_service.save_day(date, [{"index": 0, "category_id": "a", "subcategory_id": "x"}])
    logs_service.save_day(date, [{"index": 10, "category_id": "b", "subcategory_id": "y"}])
    rows = list(TimeLog.objects.filter(date=date))
    assert len(rows) == 1
    assert rows[0].category_id == "b"


def test_save_day_empty_inserts_zero_marker():
    date = "2020-03-03"
    logs_service.save_day(date, [{"index": 5, "category_id": "c", "subcategory_id": "s"}])
    result = logs_service.save_day(date, [])
    assert len(result) == 1
    assert result[0].duration == 0
    assert result[0].start_time == "00:00"
    assert TimeLog.objects.filter(date=date).count() == 1


def test_save_day_rejects_non_list_intervals():
    with pytest.raises(ValidationError):
        logs_service.save_day("2020-04-04", {"index": 0})  # type: ignore[arg-type]


def test_save_day_rejects_out_of_range_index():
    with pytest.raises(ValidationError):
        logs_service.save_day("2020-04-04", [{"index": 999}])


def test_save_day_rejects_missing_date():
    with pytest.raises(ValidationError):
        logs_service.save_day("", [{"index": 0}])


# --- update / delete ----------------------------------------------------------

def test_update_log_partial():
    row = logs_service.save_day(
        "2020-05-05", [{"index": 0, "category_id": "c", "subcategory_id": "s"}]
    )[0]
    updated = logs_service.update_log(row.id, notes="hello", duration=15)
    assert updated.notes == "hello"
    assert updated.duration == 15
    assert updated.start_time == row.start_time  # untouched


def test_update_log_not_found():
    with pytest.raises(NotFoundError):
        logs_service.update_log(999999, notes="x")


def test_update_log_rejects_negative_duration():
    row = logs_service.save_day("2020-05-06", [{"index": 0}])[0]
    with pytest.raises(ValidationError):
        logs_service.update_log(row.id, duration=-1)


def test_delete_log_removes_row():
    row = logs_service.save_day("2020-06-06", [{"index": 0}])[0]
    logs_service.delete_log(row.id)
    assert not TimeLog.objects.filter(id=row.id).exists()


def test_delete_log_not_found():
    with pytest.raises(NotFoundError):
        logs_service.delete_log(999999)


# --- categories ---------------------------------------------------------------

def test_get_categories_returns_seeded_taxonomy():
    cats = categories_service.get_categories()
    assert isinstance(cats, list) and cats
    assert {"id", "name"} <= set(cats[0])


def test_save_categories_round_trips_and_preserves_extra_keys():
    payload = [
        {
            "id": "cat_x",
            "name": "Focus",
            "colorId": "green",
            "subcategories": [{"id": "sub_x", "name": "Deep", "l": 40}],
        }
    ]
    saved = categories_service.save_categories(payload)
    assert saved == payload
    # persisted verbatim
    stored = json.loads(Setting.objects.get(pk="categories").value)
    assert stored[0]["colorId"] == "green"
    assert stored[0]["subcategories"][0]["l"] == 40
    assert categories_service.get_categories() == payload


def test_save_categories_rejects_non_list():
    with pytest.raises(ValidationError):
        categories_service.save_categories({"id": "x"})  # type: ignore[arg-type]


def test_save_categories_rejects_category_without_id():
    with pytest.raises(ValidationError):
        categories_service.save_categories([{"name": "no id"}])
