"""Agent tools for the calendar app (curated surface).

Each tool calls the same ``backend/services/`` function as its matching DRF view
(API <-> agent parity) and returns structured output via the :class:`ToolResult`
pattern. Services are injectable so the tools are unit-testable without touching
the file store. Destructive operations are gated in code by ``confirm: true``.

Schedule authoring (create/save/delete schedules, schedule-event CRUD, color
edits, PDF export) is intentionally API-only and not exposed here.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from utils.apps.calendar.backend.services import calendar as _calendar
from utils.apps.calendar.backend.services import schedules as _schedules
from utils.apps.calendar.shared.errors import CalendarError


@dataclass(frozen=True)
class ToolResult:
    ok: bool
    data: dict[str, Any]
    error: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        if self.ok:
            return self.data
        return {"error": self.error or {"code": "internal_error", "message": "Tool failed"}}


def _error(exc: CalendarError) -> dict[str, Any]:
    return ToolResult(
        ok=False,
        data={},
        error={"code": exc.code, "message": exc.message, "details": exc.details},
    ).to_dict()


def _denied(message: str) -> dict[str, Any]:
    return ToolResult(
        ok=False,
        data={},
        error={"code": "permission_denied", "message": message, "details": {}},
    ).to_dict()


# --- reads -------------------------------------------------------------------

def list_schedules(*, service=None) -> dict[str, Any]:
    svc = service or _schedules
    try:
        names = svc.list_schedules()
    except CalendarError as exc:
        return _error(exc)
    return {"schedules": names, "count": len(names)}


def get_day(*, date: str, service=None) -> dict[str, Any]:
    svc = service or _calendar
    try:
        return svc.day_view(date)
    except CalendarError as exc:
        return _error(exc)


def get_week(*, date: str | None = None, service=None) -> dict[str, Any]:
    svc = service or _calendar
    try:
        return svc.week_view(date)
    except CalendarError as exc:
        return _error(exc)


def get_range(*, start: str, end: str, service=None) -> dict[str, Any]:
    svc = service or _calendar
    try:
        return svc.range_view(start, end)
    except CalendarError as exc:
        return _error(exc)


def find_free_slots(
    *,
    date: str,
    min_duration_minutes: int = 30,
    start_after: str = "08:00",
    end_before: str = "22:00",
    service=None,
) -> dict[str, Any]:
    svc = service or _calendar
    try:
        return svc.free_slots(
            date,
            min_duration_minutes=min_duration_minutes,
            start_after=start_after,
            end_before=end_before,
        )
    except CalendarError as exc:
        return _error(exc)


def list_upcoming(
    *, days_ahead: int = 14, type_filter: str | None = None, service=None
) -> dict[str, Any]:
    svc = service or _calendar
    try:
        return svc.upcoming(days_ahead=days_ahead, type_filter=type_filter)
    except CalendarError as exc:
        return _error(exc)


# --- mutations (reversible) --------------------------------------------------

def _direct_event_payload(
    date: str, title: str, start: str, end: str, type: str, sub: str | None
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "date": date, "title": title, "type": type, "start": start, "end": end,
    }
    if sub is not None:
        payload["sub"] = sub
    return payload


def add_direct_event(
    *,
    date: str,
    title: str,
    start: str,
    end: str,
    type: str = "other",
    sub: str | None = None,
    service=None,
) -> dict[str, Any]:
    svc = service or _calendar
    try:
        index = svc.add_direct_event(_direct_event_payload(date, title, start, end, type, sub))
    except CalendarError as exc:
        return _error(exc)
    return {"added": True, "index": index}


def update_direct_event(
    *,
    index: int,
    date: str,
    title: str,
    start: str,
    end: str,
    type: str = "other",
    sub: str | None = None,
    service=None,
) -> dict[str, Any]:
    svc = service or _calendar
    try:
        svc.update_direct_event(index, _direct_event_payload(date, title, start, end, type, sub))
    except CalendarError as exc:
        return _error(exc)
    return {"updated": True, "index": index}


def add_entry(
    *, start_date: str, end_date: str, schedule_filename: str, service=None
) -> dict[str, Any]:
    svc = service or _calendar
    try:
        index = svc.add_calendar_entry(start_date, end_date, schedule_filename)
    except CalendarError as exc:
        return _error(exc)
    return {"added": True, "index": index}


# --- destructive (confirm-gated) ---------------------------------------------

def delete_direct_event(*, index: int, confirm: bool = False, service=None) -> dict[str, Any]:
    if confirm is not True:
        return _denied("Deleting a direct event requires confirm: true")
    svc = service or _calendar
    try:
        svc.delete_direct_event(index)
    except CalendarError as exc:
        return _error(exc)
    return {"deleted": True, "index": index}


def delete_event_by_title(
    *, date: str, title: str, confirm: bool = False, service=None
) -> dict[str, Any]:
    if confirm is not True:
        return _denied("Deleting an event requires confirm: true")
    svc = service or _calendar
    try:
        result = svc.delete_event_by_title(date, title)
    except CalendarError as exc:
        return _error(exc)
    return {"deleted": True, **result}


def delete_entry(*, index: int, confirm: bool = False, service=None) -> dict[str, Any]:
    if confirm is not True:
        return _denied("Deleting a schedule mapping requires confirm: true")
    svc = service or _calendar
    try:
        svc.delete_calendar_entry(index)
    except CalendarError as exc:
        return _error(exc)
    return {"deleted": True, "index": index}
