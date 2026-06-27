"""Stage 5 verification: the DRF API round-trips and stable error envelope.

The calendar app uses no database, so these tests hit the real URLconf with an
``APIClient`` against a throwaway seeded data dir. No ``@pytest.mark.django_db``.
"""

from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from utils.apps.calendar.shared import date_utils


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("MANGO_CALENDAR_DATA_DIR", str(tmp_path / "calendar"))
    return APIClient()


# --- reads -------------------------------------------------------------------

def test_list_schedules(client):
    r = client.get("/api/calendar/schedules/")
    assert r.status_code == 200
    assert "spring_2026.json" in r.json()["schedules"]


def test_schedule_detail(client):
    r = client.get("/api/calendar/schedules/spring_2026.json/")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"schedule", "colors", "stats", "breakdowns"}


def test_schedule_detail_404_envelope(client):
    r = client.get("/api/calendar/schedules/missing.json/")
    assert r.status_code == 404
    body = r.json()
    assert body["code"] == "not_found"
    assert set(body) == {"code", "message", "details"}


def test_colors_and_instructions(client):
    assert len(client.get("/api/calendar/colors/").json()) == 16
    assert "content" in client.get("/api/calendar/instructions/").json()


def test_config(client):
    body = client.get("/api/calendar/config/").json()
    assert len(body["entries"]) == 1 and len(body["direct_events"]) == 3


def test_day_week_range(client):
    day = client.get("/api/calendar/date/2026-01-23/").json()
    assert day["schedule_filename"] == "spring_2026.json"
    week = client.get("/api/calendar/week/?date=2026-01-21").json()
    assert len(week["days"]) == 7
    r = client.get("/api/calendar/range/")  # missing bounds
    assert r.status_code == 400 and r.json()["code"] == "validation_error"


# --- entries -----------------------------------------------------------------

def test_entry_overlap_conflict(client):
    r = client.post("/api/calendar/entries/", {
        "start_date": "2026-02-01", "end_date": "2026-03-01",
        "schedule_filename": "spring_2026.json",
    }, format="json")
    assert r.status_code == 409 and r.json()["code"] == "conflict"


def test_entry_create_update_delete(client):
    r = client.post("/api/calendar/entries/", {
        "start_date": "2027-01-01", "end_date": "2027-01-31",
        "schedule_filename": "spring_2026.json",
    }, format="json")
    assert r.status_code == 201
    idx = r.json()["index"]
    assert client.put(f"/api/calendar/entries/{idx}/", {
        "start_date": "2027-02-01", "end_date": "2027-02-28",
        "schedule_filename": "spring_2026.json",
    }, format="json").status_code == 200
    assert client.delete(f"/api/calendar/entries/{idx}/").status_code == 200


# --- direct events -----------------------------------------------------------

def test_direct_event_round_trip(client):
    r = client.post("/api/calendar/events/", {
        "date": "2026-09-01", "title": "Call", "type": "work",
        "start": "09:00", "end": "10:00",
    }, format="json")
    assert r.status_code == 201
    idx = r.json()["index"]
    assert client.put(f"/api/calendar/events/{idx}/", {
        "date": "2026-09-01", "title": "Call", "type": "work",
        "start": "09:30", "end": "10:30",
    }, format="json").status_code == 200
    assert client.delete(f"/api/calendar/events/{idx}/").status_code == 200


def test_direct_event_validation_400(client):
    r = client.post("/api/calendar/events/", {
        "date": "2026-09-01", "title": "x", "start": "10:00", "end": "09:00",
    }, format="json")
    assert r.status_code == 400 and r.json()["code"] == "validation_error"


def test_delete_by_title(client):
    client.post("/api/calendar/events/", {
        "date": "2026-09-02", "title": "Unique", "type": "work",
        "start": "09:00", "end": "10:00",
    }, format="json")
    r = client.post("/api/calendar/events/delete-by-title/", {
        "date": "2026-09-02", "title": "uniq",
    }, format="json")
    assert r.status_code == 200 and r.json()["success"] is True


def test_delete_by_title_ambiguous_409(client):
    for t in ("Meeting A", "Meeting B"):
        client.post("/api/calendar/events/", {
            "date": "2026-09-03", "title": t, "type": "work",
            "start": "09:00", "end": "10:00",
        }, format="json")
    r = client.post("/api/calendar/events/delete-by-title/", {
        "date": "2026-09-03", "title": "meeting",
    }, format="json")
    assert r.status_code == 409 and r.json()["code"] == "conflict"


# --- helpers -----------------------------------------------------------------

def test_free_slots(client):
    assert client.get("/api/calendar/free-slots/?date=2026-01-23").status_code == 200
    r = client.get("/api/calendar/free-slots/")  # missing date
    assert r.status_code == 400 and r.json()["code"] == "validation_error"


def test_upcoming(client):
    from datetime import timedelta

    soon = date_utils.format_date(date_utils.parse_date(date_utils.get_today()) + timedelta(days=3))
    client.post("/api/calendar/events/", {
        "date": soon, "title": "Soon", "type": "health", "start": "09:00", "end": "10:00",
    }, format="json")
    body = client.get("/api/calendar/upcoming/?days_ahead=7").json()
    assert any(e["title"] == "Soon" for e in body["events"])


# --- schedule create/delete + PDF print --------------------------------------

def test_schedule_save_and_delete(client):
    r = client.post("/api/calendar/schedules/", {
        "filename": "api_made.json",
        "name": "API Made", "events": [],
    }, format="json")
    assert r.status_code == 201
    assert "api_made.json" in client.get("/api/calendar/schedules/").json()["schedules"]
    assert client.delete("/api/calendar/schedules/api_made.json/").status_code == 200


def test_rename_category_endpoint(client):
    client.post("/api/calendar/schedules/", {
        "filename": "rn.json",
        "name": "RN",
        "events": [
            {"title": "Gym", "type": "exercise", "day": 1, "start": "07:00", "end": "08:00"},
        ],
        "color_mappings": {"exercise": "blue"},
    }, format="json")
    r = client.post("/api/calendar/schedules/rn.json/categories/rename/", {
        "old": "exercise", "new": "fitness",
    }, format="json")
    assert r.status_code == 200
    assert r.json()["updated"] == 1
    detail = client.get("/api/calendar/schedules/rn.json/").json()
    assert "fitness" in detail["colors"]
    assert "exercise" not in detail["colors"]


def test_rename_category_blank_400(client):
    client.post("/api/calendar/schedules/", {
        "filename": "rn2.json", "name": "RN2", "events": [],
    }, format="json")
    r = client.post("/api/calendar/schedules/rn2.json/categories/rename/", {
        "old": "exercise", "new": "",
    }, format="json")
    assert r.status_code == 400


def test_print_returns_pdf(client):
    r = client.post("/api/calendar/schedules/spring_2026.json/print/", {
        "timeRange": {"startHour": 7, "endHour": 20},
        "daysRange": [0, 1, 2, 3, 4],
        "hiddenCategories": [],
    }, format="json")
    assert r.status_code == 200
    assert r["Content-Type"] == "application/pdf"
    assert r.content[:4] == b"%PDF"
