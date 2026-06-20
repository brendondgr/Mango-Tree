"""Workout history (logged sessions) domain logic. Also the insertion point for
Strava-imported activities (see services/strava.py)."""

from __future__ import annotations

import json
from dataclasses import replace

from utils.apps.exercise.backend.models import History
from utils.apps.exercise.shared.errors import ConflictError, NotFoundError
from utils.apps.exercise.shared.schemas import HistoryDTO


def _to_dto(row: History) -> HistoryDTO:
    return HistoryDTO(
        id=row.id,
        workout_id=row.workout_id,
        date=row.date,
        duration=row.duration,
        volume=row.volume,
        exercises=json.loads(row.exercises or "[]"),
        start_time=row.start_time,
        notes=row.notes,
    )


def list_history() -> list[HistoryDTO]:
    return [_to_dto(row) for row in History.objects.all()]


def existing_ids() -> set[str]:
    """Return all history IDs (used for cheap dedup, e.g. Strava import)."""
    return set(History.objects.values_list("id", flat=True))


def get_log(log_id: str) -> HistoryDTO:
    row = History.objects.filter(id=log_id).first()
    if row is None:
        raise NotFoundError(f"History log {log_id} not found", details={"id": log_id})
    return _to_dto(row)


def add_log(log: HistoryDTO) -> HistoryDTO:
    if History.objects.filter(id=log.id).exists():
        raise ConflictError(
            f"History log {log.id} already exists", details={"id": log.id}
        )
    History.objects.create(
        id=log.id,
        workout_id=log.workout_id,
        date=log.date,
        start_time=log.start_time,
        duration=log.duration,
        volume=log.volume,
        notes=log.notes,
        exercises=json.dumps(log.exercises),
    )
    return log


def update_log(log_id: str, log: HistoryDTO) -> HistoryDTO:
    updated = History.objects.filter(id=log_id).update(
        duration=log.duration,
        volume=log.volume,
        notes=log.notes,
        exercises=json.dumps(log.exercises),
        start_time=log.start_time,
    )
    if not updated:
        raise NotFoundError(f"History log {log_id} not found", details={"id": log_id})
    return replace(log, id=log_id)


def delete_log(log_id: str) -> None:
    deleted, _ = History.objects.filter(id=log_id).delete()
    if not deleted:
        raise NotFoundError(f"History log {log_id} not found", details={"id": log_id})
