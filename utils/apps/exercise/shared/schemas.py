"""Data transfer objects shared by the services, DRF API, and agent tools.

These mirror the legacy WorkoutTracker Pydantic models as plain frozen
dataclasses. ``from_dict`` is the single validation entry point (raising the
app's typed :class:`ValidationError`); ``to_dict`` produces the JSON-friendly
shape returned by both the API and the agent tools.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from utils.apps.exercise.shared.errors import ValidationError


# --- validation helpers -------------------------------------------------------

def _req_str(data: dict, key: str) -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value:
        raise ValidationError(
            f"'{key}' is required and must be a non-empty string",
            details={"field": key},
        )
    return value


def _opt_str(data: dict, key: str) -> str | None:
    value = data.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValidationError(f"'{key}' must be a string", details={"field": key})
    return value


def _req_num(data: dict, key: str, cast) -> Any:
    value = data.get(key)
    if value is None:
        raise ValidationError(f"'{key}' is required", details={"field": key})
    try:
        return cast(value)
    except (TypeError, ValueError):
        raise ValidationError(
            f"'{key}' must be a {cast.__name__}", details={"field": key}
        )


def _opt_num(data: dict, key: str, cast) -> Any:
    value = data.get(key)
    if value is None:
        return None
    try:
        return cast(value)
    except (TypeError, ValueError):
        raise ValidationError(
            f"'{key}' must be a {cast.__name__}", details={"field": key}
        )


# --- DTOs ---------------------------------------------------------------------

@dataclass(frozen=True)
class ExerciseDTO:
    id: str
    name: str
    sets: int
    reps: int
    rest: int
    weight: float | None = None
    goal: float | None = None

    @classmethod
    def from_dict(cls, data: dict) -> "ExerciseDTO":
        if not isinstance(data, dict):
            raise ValidationError("exercise must be an object")
        return cls(
            id=_req_str(data, "id"),
            name=_req_str(data, "name"),
            sets=_req_num(data, "sets", int),
            reps=_req_num(data, "reps", int),
            rest=_req_num(data, "rest", int),
            weight=_opt_num(data, "weight", float),
            goal=_opt_num(data, "goal", float),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "sets": self.sets,
            "reps": self.reps,
            "rest": self.rest,
            "weight": self.weight,
            "goal": self.goal,
        }


@dataclass(frozen=True)
class WorkoutDTO:
    id: str
    name: str
    color: str
    exercises: list[ExerciseDTO] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict) -> "WorkoutDTO":
        raw_exercises = data.get("exercises", [])
        if not isinstance(raw_exercises, list):
            raise ValidationError("'exercises' must be a list", details={"field": "exercises"})
        return cls(
            id=_req_str(data, "id"),
            name=_req_str(data, "name"),
            color=_req_str(data, "color"),
            exercises=[ExerciseDTO.from_dict(item) for item in raw_exercises],
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color,
            "exercises": [exercise.to_dict() for exercise in self.exercises],
        }


@dataclass(frozen=True)
class RoutineDTO:
    id: str
    name: str
    workouts: dict[str, list[str]] = field(default_factory=dict)
    description: str | None = None

    @classmethod
    def from_dict(cls, data: dict) -> "RoutineDTO":
        workouts = data.get("workouts", {})
        if not isinstance(workouts, dict):
            raise ValidationError("'workouts' must be an object", details={"field": "workouts"})
        return cls(
            id=_req_str(data, "id"),
            name=_req_str(data, "name"),
            description=_opt_str(data, "description"),
            workouts={str(day): list(ids) for day, ids in workouts.items()},
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "workouts": self.workouts,
        }


@dataclass(frozen=True)
class EquipmentDTO:
    id: str
    name: str
    type: str
    weight: float | None = None
    min_weight: float | None = None
    max_weight: float | None = None
    unit: str | None = "lbs"
    is_bodyweight: bool = False
    color: str | None = None

    @classmethod
    def from_dict(cls, data: dict) -> "EquipmentDTO":
        return cls(
            id=_req_str(data, "id"),
            name=_req_str(data, "name"),
            type=_req_str(data, "type"),
            weight=_opt_num(data, "weight", float),
            min_weight=_opt_num(data, "min_weight", float),
            max_weight=_opt_num(data, "max_weight", float),
            unit=_opt_str(data, "unit") or "lbs",
            is_bodyweight=bool(data.get("is_bodyweight", False)),
            color=_opt_str(data, "color"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "weight": self.weight,
            "min_weight": self.min_weight,
            "max_weight": self.max_weight,
            "unit": self.unit,
            "is_bodyweight": self.is_bodyweight,
            "color": self.color,
        }


@dataclass(frozen=True)
class HistoryDTO:
    id: str
    workout_id: str
    date: str
    duration: int
    volume: float
    exercises: list[dict[str, Any]] = field(default_factory=list)
    start_time: str | None = None
    notes: str | None = None

    @classmethod
    def from_dict(cls, data: dict) -> "HistoryDTO":
        exercises = data.get("exercises", [])
        if not isinstance(exercises, list):
            raise ValidationError("'exercises' must be a list", details={"field": "exercises"})
        return cls(
            id=_req_str(data, "id"),
            workout_id=_req_str(data, "workout_id"),
            date=_req_str(data, "date"),
            duration=_req_num(data, "duration", int),
            volume=_req_num(data, "volume", float),
            exercises=exercises,
            start_time=_opt_str(data, "start_time"),
            notes=_opt_str(data, "notes"),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "workout_id": self.workout_id,
            "date": self.date,
            "start_time": self.start_time,
            "duration": self.duration,
            "volume": self.volume,
            "notes": self.notes,
            "exercises": self.exercises,
        }
