"""Workout template domain logic. Single source of truth for both the DRF API
and the agent tools."""

from __future__ import annotations

import json

from utils.apps.exercise.backend.models import Workout
from utils.apps.exercise.shared.errors import NotFoundError
from utils.apps.exercise.shared.schemas import ExerciseDTO, WorkoutDTO


def _to_dto(row: Workout) -> WorkoutDTO:
    raw = json.loads(row.exercises or "[]")
    return WorkoutDTO(
        id=row.id,
        name=row.name,
        color=row.color,
        exercises=[ExerciseDTO.from_dict(item) for item in raw],
    )


def list_workouts() -> list[WorkoutDTO]:
    return [_to_dto(row) for row in Workout.objects.all()]


def get_workout(workout_id: str) -> WorkoutDTO:
    row = Workout.objects.filter(id=workout_id).first()
    if row is None:
        raise NotFoundError(f"Workout {workout_id} not found", details={"id": workout_id})
    return _to_dto(row)


def save_workout(workout: WorkoutDTO) -> WorkoutDTO:
    """Create or update a workout (upsert on id), matching legacy semantics."""
    Workout.objects.update_or_create(
        id=workout.id,
        defaults={
            "name": workout.name,
            "color": workout.color,
            "exercises": json.dumps([exercise.to_dict() for exercise in workout.exercises]),
        },
    )
    return workout


def delete_workout(workout_id: str) -> None:
    deleted, _ = Workout.objects.filter(id=workout_id).delete()
    if not deleted:
        raise NotFoundError(f"Workout {workout_id} not found", details={"id": workout_id})
