"""Stage 4 verification: the schedule and calendar services.

Covers the ported behavior (CRUD, merge/split views, free slots, upcoming,
delete-by-title) plus validation/denial paths. Every test runs against a
throwaway seeded data dir via the ``data_dir`` fixture.
"""

from __future__ import annotations

import pytest

from utils.apps.calendar.backend.services import calendar, schedules
from utils.apps.calendar.shared import date_utils
from utils.apps.calendar.shared.errors import (
    ConflictError,
    NotFoundError,
    ValidationError,
)


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    path = tmp_path / "calendar"
    monkeypatch.setenv("MANGO_CALENDAR_DATA_DIR", str(path))
    return path


# --- Schedules ---------------------------------------------------------------

def test_list_schedules_seeded(data_dir):
    names = set(schedules.list_schedules())
    assert {"spring_2026.json", "summer_2026.json"} <= names


def test_load_schedule_expands_events(data_dir):
    data = schedules.load_schedule("spring_2026.json")
    assert "events" in data
    # every expanded event carries a single int day and an _original_idx
    for ev in data["events"]:
        assert isinstance(ev["day"], int)
        assert "_original_idx" in ev


def test_load_schedule_sanitizes_and_404s_on_traversal(data_dir):
    # path-traversal attempt is sanitized to a harmless name that does not exist
    with pytest.raises(NotFoundError):
        schedules.load_schedule("../../../../etc/passwd")


def test_load_missing_schedule_raises_not_found(data_dir):
    with pytest.raises(NotFoundError):
        schedules.load_schedule("does_not_exist.json")


def test_get_schedule_detail_has_colors_stats_breakdowns(data_dir):
    detail = schedules.get_schedule_detail("spring_2026.json")
    assert set(detail) == {"schedule", "colors", "stats", "breakdowns"}
    assert detail["colors"]  # one entry per type
    assert "total" in detail["stats"] and "by_category" in detail["stats"]


def test_auto_color_mappings_persisted_on_load(data_dir):
    # a schedule with no color_mappings gets them generated AND written back
    schedules.save_schedule("nocolors.json", {"name": "NC", "events": [
        {"title": "Gym", "type": "exercise", "day": 1, "start": "07:00", "end": "08:00"},
    ]})
    loaded = schedules.load_schedule("nocolors.json")
    assert loaded["color_mappings"]["exercise"]
    # persisted: a second raw load sees the mapping on disk
    raw, _ = schedules._load_raw_schedule("nocolors.json")
    assert "color_mappings" in raw


def test_schedule_event_crud(data_dir):
    schedules.save_schedule("edit.json", {"name": "E", "events": []})
    idx = schedules.add_event("edit.json", {
        "title": "Lunch", "type": "food", "day": 2, "start": "12:00", "end": "13:00",
    })
    assert idx == 0
    schedules.update_event("edit.json", 0, {
        "title": "Brunch", "type": "food", "day": 2, "start": "11:00", "end": "12:00",
    })
    raw, _ = schedules._load_raw_schedule("edit.json")
    assert raw["events"][0]["title"] == "Brunch"
    schedules.delete_event("edit.json", 0)
    raw, _ = schedules._load_raw_schedule("edit.json")
    assert raw["events"] == []


def test_add_invalid_event_raises_validation(data_dir):
    schedules.save_schedule("v.json", {"name": "V", "events": []})
    with pytest.raises(ValidationError):
        schedules.add_event("v.json", {"title": "x", "type": "t", "day": 1, "start": "99:99", "end": "10:00"})


def test_update_event_out_of_range_raises_not_found(data_dir):
    schedules.save_schedule("r.json", {"name": "R", "events": []})
    with pytest.raises(NotFoundError):
        schedules.update_event("r.json", 5, {"title": "x", "type": "t", "day": 1, "start": "09:00", "end": "10:00"})


def test_delete_schedule_cascades_entries(data_dir):
    schedules.save_schedule("temp.json", {"name": "Temp", "events": []})
    calendar.add_calendar_entry("2027-01-01", "2027-01-31", "temp.json")
    removed = schedules.delete_schedule("temp.json")
    assert removed == 1
    assert "temp.json" not in schedules.list_schedules()
    assert all(e["schedule_filename"] != "temp.json" for e in calendar.load_calendar()["entries"])


def test_predefined_colors_and_instructions(data_dir):
    assert len(schedules.predefined_colors()) == 16
    assert "JSON" in schedules.load_instructions() or "schedule" in schedules.load_instructions().lower()


# --- Calendar config + entries ----------------------------------------------

def test_seeded_calendar_config(data_dir):
    config = calendar.load_calendar()
    assert len(config["entries"]) == 1
    assert len(config["direct_events"]) == 3


def test_entry_overlap_raises_conflict(data_dir):
    # seed already maps 2026-01-07..2026-04-25 to spring_2026
    with pytest.raises(ConflictError):
        calendar.add_calendar_entry("2026-02-01", "2026-03-01", "spring_2026.json")


def test_entry_bad_dates_raise_validation(data_dir):
    with pytest.raises(ValidationError):
        calendar.add_calendar_entry("not-a-date", "2026-03-01", "spring_2026.json")
    with pytest.raises(ValidationError):
        calendar.add_calendar_entry("2027-05-01", "2027-04-01", "spring_2026.json")  # start > end


def test_entry_missing_schedule_raises_validation(data_dir):
    with pytest.raises(ValidationError):
        calendar.add_calendar_entry("2027-01-01", "2027-02-01", "ghost.json")


def test_entry_update_delete(data_dir):
    idx = calendar.add_calendar_entry("2027-01-01", "2027-01-31", "spring_2026.json")
    calendar.update_calendar_entry(idx, "2027-02-01", "2027-02-28", "spring_2026.json")
    assert calendar.load_calendar()["entries"][idx]["start_date"] == "2027-02-01"
    calendar.delete_calendar_entry(idx)
    with pytest.raises(NotFoundError):
        calendar.delete_calendar_entry(idx)


# --- Direct events -----------------------------------------------------------

def test_direct_event_crud_and_normalization(data_dir):
    idx = calendar.add_direct_event({
        "date": "2026-07-01", "title": "Dentist", "start": "09:00", "end": "10:00",
    })
    stored = calendar.load_calendar()["direct_events"][idx]
    assert stored["type"] == "other"  # default applied
    assert "sub" not in stored        # absent key stays absent
    calendar.update_direct_event(idx, {
        "date": "2026-07-01", "title": "Dentist", "type": "health",
        "start": "09:30", "end": "10:30", "sub": "checkup",
    })
    stored = calendar.load_calendar()["direct_events"][idx]
    assert stored["type"] == "health" and stored["sub"] == "checkup"
    calendar.delete_direct_event(idx)
    with pytest.raises(NotFoundError):
        calendar.delete_direct_event(idx)


def test_direct_event_validation(data_dir):
    with pytest.raises(ValidationError):
        calendar.add_direct_event({"date": "2026-07-01", "title": "x", "start": "10:00", "end": "09:00"})
    with pytest.raises(ValidationError):
        calendar.add_direct_event({"title": "x", "start": "09:00", "end": "10:00"})  # missing date


# --- Merged views ------------------------------------------------------------

def test_day_view_merges_schedule_and_direct(data_dir):
    view = calendar.day_view("2026-01-23")  # within spring range; has a direct event
    assert view["schedule_filename"] == "spring_2026.json"
    titles = [e.get("title") for e in view["events"]]
    assert "Appointment Example" in titles
    assert view["colors"]


def test_week_view_shape(data_dir):
    view = calendar.week_view("2026-01-21")
    assert "days" in view and len(view["days"]) == 7
    sample = next(iter(view["days"].values()))
    assert set(sample) == {"schedule_filename", "schedule_name", "schedule_color", "events"}


def test_range_view_requires_bounds(data_dir):
    with pytest.raises(ValidationError):
        calendar.range_view("", "2026-01-10")


# --- Free slots / upcoming / delete-by-title ---------------------------------

def test_free_slots_avoid_busy(data_dir):
    result = calendar.free_slots("2026-01-23", min_duration_minutes=30,
                                 start_after="08:00", end_before="22:00")
    # the appointment (10:00-11:00) must not fall inside any free slot
    for slot in result["free_slots"]:
        s = date_utils.parse_time(slot["start"])
        e = date_utils.parse_time(slot["end"])
        assert not (s < date_utils.parse_time("11:00") and date_utils.parse_time("10:00") < e)


def test_upcoming_finds_future_event(data_dir):
    from datetime import timedelta

    today = date_utils.parse_date(date_utils.get_today())
    soon = date_utils.format_date(today + timedelta(days=2))
    calendar.add_direct_event({"date": soon, "title": "Soon", "type": "health",
                               "start": "09:00", "end": "10:00"})
    result = calendar.upcoming(days_ahead=7)
    assert any(e["title"] == "Soon" for e in result["events"])
    # type filter narrows
    assert calendar.upcoming(days_ahead=7, type_filter="nonexistent")["count"] == 0


def test_delete_by_title_single(data_dir):
    calendar.add_direct_event({"date": "2026-08-01", "title": "Unique Meeting",
                               "type": "work", "start": "09:00", "end": "10:00"})
    result = calendar.delete_event_by_title("2026-08-01", "unique")
    assert result["deleted_event"]["title"] == "Unique Meeting"


def test_delete_by_title_none_raises_not_found(data_dir):
    with pytest.raises(NotFoundError):
        calendar.delete_event_by_title("2026-08-01", "nothing here")


def test_delete_by_title_ambiguous_raises_conflict(data_dir):
    calendar.add_direct_event({"date": "2026-08-02", "title": "Meeting A", "type": "work", "start": "09:00", "end": "10:00"})
    calendar.add_direct_event({"date": "2026-08-02", "title": "Meeting B", "type": "work", "start": "11:00", "end": "12:00"})
    with pytest.raises(ConflictError) as exc:
        calendar.delete_event_by_title("2026-08-02", "meeting")
    assert "matches" in exc.value.details
