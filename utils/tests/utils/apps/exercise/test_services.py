"""Stage 4 verification: ported domain services, including validation/denial
cases. Runs against a per-test throwaway copy of the real database."""

from __future__ import annotations

import json

import pytest

from utils.apps.exercise.backend.models import Routine
from utils.apps.exercise.backend.services import (
    equipment as equipment_service,
)
from utils.apps.exercise.backend.services import (
    history as history_service,
)
from utils.apps.exercise.backend.services import (
    routines as routine_service,
)
from utils.apps.exercise.backend.services import (
    workouts as workout_service,
)
from utils.apps.exercise.shared.errors import (
    ConflictError,
    NotFoundError,
    ValidationError,
)
from utils.apps.exercise.shared.schemas import (
    EquipmentDTO,
    HistoryDTO,
    RoutineDTO,
    WorkoutDTO,
)


# --- workouts -----------------------------------------------------------------

@pytest.mark.needs_legacy_data
def test_list_workouts_returns_dtos_with_parsed_exercises():
    workouts = workout_service.list_workouts()
    assert len(workouts) == 7
    assert all(isinstance(w, WorkoutDTO) for w in workouts)
    # exercises parsed from TEXT JSON into structured DTOs
    assert all(isinstance(w.exercises, list) for w in workouts)


@pytest.mark.needs_legacy_data
def test_save_workout_upserts():
    dto = WorkoutDTO(id="wk_test", name="Test", color="red", exercises=[])
    workout_service.save_workout(dto)
    assert workout_service.get_workout("wk_test").name == "Test"
    # update via same id (upsert), not duplicate
    workout_service.save_workout(WorkoutDTO(id="wk_test", name="Renamed", color="blue"))
    assert workout_service.get_workout("wk_test").name == "Renamed"
    assert len(workout_service.list_workouts()) == 8


def test_get_workout_missing_raises_not_found():
    with pytest.raises(NotFoundError):
        workout_service.get_workout("does-not-exist")


def test_delete_workout_missing_raises_not_found():
    with pytest.raises(NotFoundError):
        workout_service.delete_workout("does-not-exist")


def test_workout_from_dict_rejects_missing_field():
    with pytest.raises(ValidationError):
        WorkoutDTO.from_dict({"id": "x", "color": "red"})  # missing name


# --- routines -----------------------------------------------------------------

def test_save_and_list_routines():
    dto = RoutineDTO(id="rt_test", name="Split", workouts={"Mon": ["wk_1"]})
    routine_service.save_routine(dto)
    found = routine_service.get_routine("rt_test")
    assert found.workouts["Mon"] == ["wk_1"]


def test_routine_legacy_list_shape_is_normalized():
    # Simulate a legacy row that stored a bare list instead of a weekday map.
    Routine.objects.create(id="rt_legacy", name="Old", workouts=json.dumps(["wk_a", "wk_b"]))
    dto = routine_service.get_routine("rt_legacy")
    assert dto.workouts["Mon"] == ["wk_a", "wk_b"]
    assert dto.workouts["Sun"] == []
    assert set(dto.workouts) == {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"}


def test_delete_routine_missing_raises_not_found():
    with pytest.raises(NotFoundError):
        routine_service.delete_routine("nope")


# --- equipment ----------------------------------------------------------------

@pytest.mark.needs_legacy_data
def test_equipment_is_bodyweight_exposed_as_bool():
    items = equipment_service.list_equipment()
    assert len(items) == 8
    assert all(isinstance(e.is_bodyweight, bool) for e in items)


def test_add_equipment_then_duplicate_conflicts():
    dto = EquipmentDTO(id="eq_test", name="Kettlebell", type="weight", weight=35.0)
    equipment_service.add_equipment(dto)
    assert any(e.id == "eq_test" for e in equipment_service.list_equipment())
    with pytest.raises(ConflictError):
        equipment_service.add_equipment(dto)


def test_update_equipment_missing_raises_not_found():
    dto = EquipmentDTO(id="ghost", name="X", type="weight")
    with pytest.raises(NotFoundError):
        equipment_service.update_equipment("ghost", dto)


def test_update_equipment_persists_bodyweight_as_int():
    dto = EquipmentDTO(id="eq_bw", name="Pullup", type="bodyweight", is_bodyweight=True)
    equipment_service.add_equipment(dto)
    equipment_service.update_equipment("eq_bw", EquipmentDTO(id="eq_bw", name="Pullup", type="bodyweight", is_bodyweight=False))
    stored = next(e for e in equipment_service.list_equipment() if e.id == "eq_bw")
    assert stored.is_bodyweight is False


# --- history ------------------------------------------------------------------

@pytest.mark.needs_legacy_data
def test_list_history_baseline():
    logs = history_service.list_history()
    assert len(logs) == 901
    assert all(isinstance(log.exercises, list) for log in logs)


def test_add_history_then_duplicate_conflicts():
    dto = HistoryDTO(
        id="hist_test",
        workout_id="wk_1",
        date="2026-06-20",
        duration=1800,
        volume=1200.0,
        exercises=[{"name": "Squat", "sets": 3}],
    )
    history_service.add_log(dto)
    assert history_service.get_log("hist_test").volume == 1200.0
    with pytest.raises(ConflictError):
        history_service.add_log(dto)


def test_update_history_missing_raises_not_found():
    dto = HistoryDTO(id="ghost", workout_id="w", date="2026-06-20", duration=1, volume=1.0)
    with pytest.raises(NotFoundError):
        history_service.update_log("ghost", dto)


def test_delete_history_removes_row():
    dto = HistoryDTO(id="hist_del", workout_id="wk_1", date="2026-06-20", duration=1, volume=1.0)
    history_service.add_log(dto)
    history_service.delete_log("hist_del")
    with pytest.raises(NotFoundError):
        history_service.get_log("hist_del")


def test_history_allows_orphan_workout_id_like_strava():
    # Legacy behavior: run/walk (and Strava) logs use workout_ids that are not
    # rows in the workouts table. FK enforcement must stay off so these insert.
    dto = HistoryDTO(
        id="strava_999",
        workout_id="run",
        date="2026-06-20",
        duration=1800,
        volume=3.1,
        exercises=[{"name": "Strava Run", "distance": 3.1, "unit": "mi"}],
    )
    history_service.add_log(dto)
    assert history_service.get_log("strava_999").workout_id == "run"


def test_history_from_dict_rejects_bad_duration():
    with pytest.raises(ValidationError):
        HistoryDTO.from_dict(
            {"id": "x", "workout_id": "w", "date": "2026-06-20", "duration": "abc", "volume": 1.0}
        )
