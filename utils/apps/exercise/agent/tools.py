"""Agent tools for the exercise app.

Each tool calls the same ``backend/services/`` function as its matching DRF view
(API <-> agent parity), returns structured output via the :class:`ToolResult`
pattern, and confirm-gates destructive operations. Services are injectable so the
tools are unit-testable without touching the database.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from utils.apps.exercise.backend.services import equipment as _equipment
from utils.apps.exercise.backend.services import history as _history
from utils.apps.exercise.backend.services import routines as _routines
from utils.apps.exercise.backend.services import strava as _strava
from utils.apps.exercise.backend.services import workouts as _workouts
from utils.apps.exercise.shared.errors import ExerciseError
from utils.apps.exercise.shared.schemas import (
    EquipmentDTO,
    HistoryDTO,
    RoutineDTO,
    WorkoutDTO,
)


@dataclass(frozen=True)
class ToolResult:
    ok: bool
    data: dict[str, Any]
    error: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        if self.ok:
            return self.data
        return {"error": self.error or {"code": "internal_error", "message": "Tool failed"}}


def _error(exc: ExerciseError) -> dict[str, Any]:
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


# --- workouts -----------------------------------------------------------------

def list_workouts(*, service=None) -> dict[str, Any]:
    svc = service or _workouts
    try:
        items = svc.list_workouts()
    except ExerciseError as exc:
        return _error(exc)
    return {"workouts": [w.to_dict() for w in items]}


def save_workout(*, workout: dict | None = None, service=None) -> dict[str, Any]:
    svc = service or _workouts
    try:
        dto = WorkoutDTO.from_dict(workout or {})
        saved = svc.save_workout(dto)
    except ExerciseError as exc:
        return _error(exc)
    return {"workout": saved.to_dict()}


def delete_workout(*, workout_id: str, confirm: bool = False, service=None) -> dict[str, Any]:
    if confirm is not True:
        return _denied("Deleting a workout requires confirm: true")
    svc = service or _workouts
    try:
        svc.delete_workout(workout_id)
    except ExerciseError as exc:
        return _error(exc)
    return {"deleted": True}


# --- routines -----------------------------------------------------------------

def list_routines(*, service=None) -> dict[str, Any]:
    svc = service or _routines
    try:
        items = svc.list_routines()
    except ExerciseError as exc:
        return _error(exc)
    return {"routines": [r.to_dict() for r in items]}


def save_routine(*, routine: dict | None = None, service=None) -> dict[str, Any]:
    svc = service or _routines
    try:
        dto = RoutineDTO.from_dict(routine or {})
        saved = svc.save_routine(dto)
    except ExerciseError as exc:
        return _error(exc)
    return {"routine": saved.to_dict()}


def delete_routine(*, routine_id: str, confirm: bool = False, service=None) -> dict[str, Any]:
    if confirm is not True:
        return _denied("Deleting a routine requires confirm: true")
    svc = service or _routines
    try:
        svc.delete_routine(routine_id)
    except ExerciseError as exc:
        return _error(exc)
    return {"deleted": True}


# --- equipment ----------------------------------------------------------------

def list_equipment(*, service=None) -> dict[str, Any]:
    svc = service or _equipment
    try:
        items = svc.list_equipment()
    except ExerciseError as exc:
        return _error(exc)
    return {"equipment": [e.to_dict() for e in items]}


def add_equipment(*, equipment: dict | None = None, service=None) -> dict[str, Any]:
    svc = service or _equipment
    try:
        dto = EquipmentDTO.from_dict(equipment or {})
        created = svc.add_equipment(dto)
    except ExerciseError as exc:
        return _error(exc)
    return {"equipment": created.to_dict()}


def update_equipment(*, equip_id: str, equipment: dict | None = None, service=None) -> dict[str, Any]:
    svc = service or _equipment
    try:
        dto = EquipmentDTO.from_dict(equipment or {})
        updated = svc.update_equipment(equip_id, dto)
    except ExerciseError as exc:
        return _error(exc)
    return {"equipment": updated.to_dict()}


def delete_equipment(*, equip_id: str, confirm: bool = False, service=None) -> dict[str, Any]:
    if confirm is not True:
        return _denied("Deleting equipment requires confirm: true")
    svc = service or _equipment
    try:
        svc.delete_equipment(equip_id)
    except ExerciseError as exc:
        return _error(exc)
    return {"deleted": True}


# --- history ------------------------------------------------------------------

def list_history(*, service=None) -> dict[str, Any]:
    svc = service or _history
    try:
        items = svc.list_history()
    except ExerciseError as exc:
        return _error(exc)
    return {"history": [h.to_dict() for h in items]}


def log_workout(*, log: dict | None = None, service=None) -> dict[str, Any]:
    """Record a completed workout session (appends to history)."""
    svc = service or _history
    try:
        dto = HistoryDTO.from_dict(log or {})
        created = svc.add_log(dto)
    except ExerciseError as exc:
        return _error(exc)
    return {"log": created.to_dict()}


def update_log(*, log_id: str, log: dict | None = None, service=None) -> dict[str, Any]:
    svc = service or _history
    try:
        dto = HistoryDTO.from_dict(log or {})
        updated = svc.update_log(log_id, dto)
    except ExerciseError as exc:
        return _error(exc)
    return {"log": updated.to_dict()}


def delete_log(*, log_id: str, confirm: bool = False, service=None) -> dict[str, Any]:
    if confirm is not True:
        return _denied("Deleting a history log requires confirm: true")
    svc = service or _history
    try:
        svc.delete_log(log_id)
    except ExerciseError as exc:
        return _error(exc)
    return {"deleted": True}


# --- strava -------------------------------------------------------------------

def sync_strava(*, period: str = "week", service=None) -> dict[str, Any]:
    """Import Strava Run/Walk activities into history (additive, dedups)."""
    svc = service or _strava
    try:
        summary = svc.sync_strava(period)
    except ExerciseError as exc:
        return _error(exc)
    return {"strava_sync": summary}
