"""Time-log domain logic. Single source of truth for both the DRF API and the
agent tools.

Ported from the legacy Flask ``/api/logs`` and ``/api/stats`` handlers, with the
request/response plumbing removed: every function takes explicit arguments and
returns typed data or raises a typed error.
"""

from __future__ import annotations

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from utils.apps.timekeeper.backend.models import TimeLog
from utils.apps.timekeeper.shared.constants import DB_ALIAS
from utils.apps.timekeeper.shared.errors import NotFoundError, ValidationError
from utils.apps.timekeeper.shared.intervals import Interval, group_intervals
from utils.apps.timekeeper.shared.schemas import (
    TimeLogDTO,
    parse_intervals,
    validate_date,
)


def _to_dto(row: TimeLog) -> TimeLogDTO:
    return TimeLogDTO(
        id=row.id,
        date=row.date,
        start_time=row.start_time,
        duration=row.duration,
        category_id=row.category_id,
        subcategory_id=row.subcategory_id,
        notes=row.notes,
        created_at=row.created_at,
    )


def _get_row(log_id: int) -> TimeLog:
    row = TimeLog.objects.filter(id=log_id).first()
    if row is None:
        raise NotFoundError(f"Log {log_id} not found", details={"id": log_id})
    return row


def list_logs(date: str | None = None) -> list[TimeLogDTO]:
    """List tracked intervals. With ``date`` set, only that day (ordered by start
    time); otherwise every log, newest date first. Mirrors ``GET /api/logs``."""
    qs = TimeLog.objects.all()
    if date:
        date = validate_date(date)
        qs = qs.filter(date=date).order_by("start_time", "id")
    else:
        qs = qs.order_by("-date", "start_time", "id")
    return [_to_dto(row) for row in qs]


def daily_totals() -> list[dict]:
    """Total tracked minutes per day, oldest first. Mirrors ``GET /api/stats``."""
    rows = (
        TimeLog.objects.values("date")
        .annotate(total_duration=Sum("duration"))
        .order_by("date")
    )
    return [
        {"date": row["date"], "total_duration": row["total_duration"] or 0}
        for row in rows
    ]


def save_day(date: str, intervals: list[Interval] | list[dict]) -> list[TimeLogDTO]:
    """Replace a day's logs from a set of painted 5-minute blocks.

    Deletes the day's existing rows and rewrites them from ``intervals`` grouped
    into contiguous same-subcategory chunks. An empty ``intervals`` list clears
    the day and records a single 0-minute marker row (so the day reads as
    "tracked, empty"), preserving the legacy behaviour. Returns the resulting
    day's logs.
    """
    date = validate_date(date)
    parsed = _coerce_intervals(intervals)

    with transaction.atomic(using=DB_ALIAS):
        TimeLog.objects.filter(date=date).delete()

        now = timezone.now()
        if not parsed:
            marker = TimeLog.objects.create(
                date=date, start_time="00:00", duration=0, created_at=now
            )
            return [_to_dto(marker)]

        created: list[TimeLog] = []
        for chunk in group_intervals(parsed):
            created.append(
                TimeLog.objects.create(
                    date=date,
                    start_time=chunk.start_time,
                    duration=chunk.duration,
                    category_id=chunk.category_id,
                    subcategory_id=chunk.subcategory_id,
                    created_at=now,
                )
            )
    return [_to_dto(row) for row in created]


def update_log(
    log_id: int,
    *,
    start_time: str | None = None,
    duration: int | None = None,
    notes: str | None = None,
    clear_notes: bool = False,
) -> TimeLogDTO:
    """Update a single log's start time, duration, and/or notes."""
    row = _get_row(log_id)
    fields: list[str] = []
    if start_time is not None:
        if not isinstance(start_time, str) or not start_time.strip():
            raise ValidationError("'start_time' must be a non-empty string", details={"field": "start_time"})
        row.start_time = start_time.strip()
        fields.append("start_time")
    if duration is not None:
        if not isinstance(duration, int) or isinstance(duration, bool) or duration < 0:
            raise ValidationError("'duration' must be a non-negative integer", details={"field": "duration"})
        row.duration = duration
        fields.append("duration")
    if clear_notes:
        row.notes = None
        fields.append("notes")
    elif notes is not None:
        row.notes = notes
        fields.append("notes")
    if fields:
        row.save(update_fields=fields)
    return _to_dto(row)


def delete_log(log_id: int) -> None:
    """Delete a single log row. Mirrors ``DELETE /api/logs/<id>``."""
    deleted, _ = TimeLog.objects.filter(id=log_id).delete()
    if not deleted:
        raise NotFoundError(f"Log {log_id} not found", details={"id": log_id})


def _coerce_intervals(intervals: list[Interval] | list[dict]) -> list[Interval]:
    """Accept already-parsed Intervals (service/tool callers) or raw dicts (which
    are validated through the shared parser)."""
    if all(isinstance(iv, Interval) for iv in intervals):
        return list(intervals)
    return parse_intervals(intervals)
