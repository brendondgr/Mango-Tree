"""Stage 3 verification: the managed=False models read the legacy data
unchanged, and the test harness never mutates the live database file."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from django.conf import settings

from utils.apps.exercise.backend.models import Equipment, History, Routine, Workout

# Baseline row counts in the legacy WorkoutTracker database at migration time.
EXPECTED_COUNTS = {"workouts": 7, "routines": 3, "equipment": 8, "history": 901}


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_counts_match_legacy_baseline():
    assert Workout.objects.count() == EXPECTED_COUNTS["workouts"]
    assert Routine.objects.count() == EXPECTED_COUNTS["routines"]
    assert Equipment.objects.count() == EXPECTED_COUNTS["equipment"]
    assert History.objects.count() == EXPECTED_COUNTS["history"]


def test_models_route_to_exercise_connection():
    assert Workout.objects.db == "exercise"
    assert History.objects.db == "exercise"


def test_workout_json_and_fields_read_back():
    workout = Workout.objects.first()
    assert workout is not None
    # exercises is stored as TEXT and must be valid JSON the service can parse.
    parsed = json.loads(workout.exercises)
    assert isinstance(parsed, list)
    assert isinstance(workout.id, str) and workout.id
    assert isinstance(workout.name, str)


def test_equipment_bodyweight_stored_as_int():
    # Preserve the legacy storage: is_bodyweight is an INTEGER (0/1), not a bool.
    for value in Equipment.objects.values_list("is_bodyweight", flat=True):
        assert value in (0, 1, None)


def test_history_start_time_nullable():
    # start_time was added via ALTER; it may be present or null, never missing.
    row = History.objects.first()
    assert hasattr(row, "start_time")


def test_harness_uses_throwaway_copy_not_live_db(exercise_db):
    # The bound DB path is the per-test temp copy, not the real data file.
    live = Path(settings.BASE_DIR) / "data" / "exercise" / "workouttracker.db"
    assert Path(exercise_db) != live

    # A write through the ORM must not change the live file on disk.
    before = _sha256(live)
    obj = Workout.objects.first()
    Workout.objects.filter(pk=obj.pk).update(name=obj.name + " (temp-edit)")
    assert _sha256(live) == before
