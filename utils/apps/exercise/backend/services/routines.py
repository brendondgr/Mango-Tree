"""Weekly routine domain logic."""

from __future__ import annotations

import json

from utils.apps.exercise.backend.models import Routine
from utils.apps.exercise.shared.constants import WEEKDAYS
from utils.apps.exercise.shared.errors import NotFoundError
from utils.apps.exercise.shared.schemas import RoutineDTO


def _normalize_workouts(raw: object) -> dict[str, list[str]]:
    """Legacy rows sometimes stored a bare list; normalize to a weekday map."""
    if isinstance(raw, list):
        return {day: (list(raw) if day == "Mon" else []) for day in WEEKDAYS}
    if isinstance(raw, dict):
        return {str(day): list(ids) for day, ids in raw.items()}
    return {day: [] for day in WEEKDAYS}


def _to_dto(row: Routine) -> RoutineDTO:
    return RoutineDTO(
        id=row.id,
        name=row.name,
        description=row.description,
        workouts=_normalize_workouts(json.loads(row.workouts or "{}")),
    )


def list_routines() -> list[RoutineDTO]:
    return [_to_dto(row) for row in Routine.objects.all()]


def get_routine(routine_id: str) -> RoutineDTO:
    row = Routine.objects.filter(id=routine_id).first()
    if row is None:
        raise NotFoundError(f"Routine {routine_id} not found", details={"id": routine_id})
    return _to_dto(row)


def save_routine(routine: RoutineDTO) -> RoutineDTO:
    """Create or update a routine (upsert on id), matching legacy semantics."""
    Routine.objects.update_or_create(
        id=routine.id,
        defaults={
            "name": routine.name,
            "description": routine.description,
            "workouts": json.dumps(routine.workouts),
        },
    )
    return routine


def delete_routine(routine_id: str) -> None:
    deleted, _ = Routine.objects.filter(id=routine_id).delete()
    if not deleted:
        raise NotFoundError(f"Routine {routine_id} not found", details={"id": routine_id})
