"""Stage 6 verification: agent tools produce structured output, call the same
services as the API, and deny missing-confirmation deletes."""

from __future__ import annotations

import importlib
from pathlib import Path
from unittest.mock import MagicMock

import yaml
from django.conf import settings

from utils.apps.exercise.agent import tools
from utils.apps.exercise.shared.errors import NotFoundError
from utils.apps.exercise.shared.schemas import WorkoutDTO


# --- structured output + service delegation (mocked, no DB) --------------------

def test_list_workouts_returns_structured_output():
    mock = MagicMock()
    mock.list_workouts.return_value = [WorkoutDTO(id="w1", name="Push", color="red")]
    payload = tools.list_workouts(service=mock)
    assert payload["workouts"][0]["id"] == "w1"
    mock.list_workouts.assert_called_once_with()


def test_save_workout_delegates_to_service():
    mock = MagicMock()
    dto = WorkoutDTO(id="w2", name="Pull", color="blue")
    mock.save_workout.return_value = dto
    payload = tools.save_workout(
        workout={"id": "w2", "name": "Pull", "color": "blue", "exercises": []},
        service=mock,
    )
    assert payload["workout"]["id"] == "w2"
    mock.save_workout.assert_called_once()


def test_save_workout_validation_error_does_not_call_service():
    mock = MagicMock()
    payload = tools.save_workout(workout={"id": "x"}, service=mock)  # missing name/color
    assert payload["error"]["code"] == "validation_error"
    mock.save_workout.assert_not_called()


# --- destructive confirm-gating -----------------------------------------------

def test_delete_workout_without_confirm_is_denied():
    mock = MagicMock()
    payload = tools.delete_workout(workout_id="w1", confirm=False, service=mock)
    assert payload["error"]["code"] == "permission_denied"
    mock.delete_workout.assert_not_called()


def test_delete_workout_with_confirm_calls_service():
    mock = MagicMock()
    mock.delete_workout.return_value = None
    payload = tools.delete_workout(workout_id="w1", confirm=True, service=mock)
    assert payload == {"deleted": True}
    mock.delete_workout.assert_called_once_with("w1")


def test_delete_log_without_confirm_is_denied():
    mock = MagicMock()
    payload = tools.delete_log(log_id="h1", confirm=False, service=mock)
    assert payload["error"]["code"] == "permission_denied"
    mock.delete_log.assert_not_called()


def test_tool_surfaces_service_not_found():
    mock = MagicMock()
    mock.delete_workout.side_effect = NotFoundError("missing")
    payload = tools.delete_workout(workout_id="ghost", confirm=True, service=mock)
    assert payload["error"]["code"] == "not_found"


# --- registry manifest consistency --------------------------------------------

def test_tools_yaml_entries_resolve():
    config = yaml.safe_load((Path(settings.BASE_DIR) / "config" / "tools.yaml").read_text())
    exercise_tools = {
        name: meta
        for name, meta in config["tools"].items()
        if meta.get("app") == "exercise"
    }
    assert len(exercise_tools) == 14
    for meta in exercise_tools.values():
        module = importlib.import_module(meta["module"])
        assert callable(getattr(module, meta["function"]))


# --- integration against the throwaway DB copy --------------------------------

def test_list_history_integration():
    payload = tools.list_history()
    assert len(payload["history"]) == 901


def test_log_then_confirm_delete_integration():
    log = {
        "id": "hist_tool",
        "workout_id": "run",
        "date": "2026-06-20",
        "duration": 1200,
        "volume": 2.5,
        "exercises": [],
    }
    assert tools.log_workout(log=log)["log"]["id"] == "hist_tool"

    denied = tools.delete_log(log_id="hist_tool", confirm=False)
    assert denied["error"]["code"] == "permission_denied"

    assert tools.delete_log(log_id="hist_tool", confirm=True) == {"deleted": True}
