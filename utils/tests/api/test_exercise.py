"""Stage 5 verification: the DRF API over the exercise services, including
stable error codes and pagination. Runs against a throwaway DB copy."""

from __future__ import annotations

import json

import pytest

from django.test import Client


def _post(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type="application/json")


def _put(client, url, payload):
    return client.put(url, data=json.dumps(payload), content_type="application/json")


# --- workouts -----------------------------------------------------------------

@pytest.mark.needs_legacy_data
def test_list_workouts_envelope(exercise_db):
    res = Client().get("/api/exercise/workouts/")
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"count", "next", "previous", "results"}
    assert body["count"] == 7


@pytest.mark.needs_legacy_data
def test_create_then_list_workout(exercise_db):
    client = Client()
    payload = {"id": "wk_api", "name": "API Day", "color": "green", "exercises": []}
    res = _post(client, "/api/exercise/workouts/", payload)
    assert res.status_code == 200
    assert res.json()["name"] == "API Day"
    assert client.get("/api/exercise/workouts/").json()["count"] == 8


def test_create_workout_validation_error(exercise_db):
    res = _post(Client(), "/api/exercise/workouts/", {"id": "x", "color": "red"})
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"


def test_delete_missing_workout_returns_404(exercise_db):
    res = Client().delete("/api/exercise/workouts/nope/")
    assert res.status_code == 404
    assert res.json()["code"] == "not_found"


def test_delete_workout_success(exercise_db):
    client = Client()
    _post(client, "/api/exercise/workouts/", {"id": "wk_del", "name": "x", "color": "red"})
    res = client.delete("/api/exercise/workouts/wk_del/")
    assert res.status_code == 204


# --- routines & equipment -----------------------------------------------------

@pytest.mark.needs_legacy_data
def test_list_routines(exercise_db):
    assert Client().get("/api/exercise/routines/").json()["count"] == 3


@pytest.mark.needs_legacy_data
def test_equipment_bodyweight_is_bool_in_payload(exercise_db):
    results = Client().get("/api/exercise/equipment/?page_size=100").json()["results"]
    assert len(results) == 8
    assert all(isinstance(item["is_bodyweight"], bool) for item in results)


def test_add_equipment_conflict_returns_409(exercise_db):
    client = Client()
    payload = {"id": "eq_api", "name": "Band", "type": "resistance"}
    assert _post(client, "/api/exercise/equipment/", payload).status_code == 201
    res = _post(client, "/api/exercise/equipment/", payload)
    assert res.status_code == 409
    assert res.json()["code"] == "conflict"


def test_update_missing_equipment_returns_404(exercise_db):
    res = _put(Client(), "/api/exercise/equipment/ghost/", {"id": "ghost", "name": "x", "type": "weight"})
    assert res.status_code == 404


# --- history ------------------------------------------------------------------

@pytest.mark.needs_legacy_data
def test_history_count_and_pagination(exercise_db):
    client = Client()
    full = client.get("/api/exercise/history/?page_size=2000").json()
    assert full["count"] == 901
    assert len(full["results"]) == 901

    paged = client.get("/api/exercise/history/").json()  # default page_size 25
    assert len(paged["results"]) == 25
    assert paged["next"] == 2
    assert paged["previous"] is None


def test_add_history_with_orphan_workout_id(exercise_db):
    payload = {
        "id": "strava_api_1",
        "workout_id": "run",
        "date": "2026-06-20",
        "duration": 1800,
        "volume": 3.1,
        "exercises": [{"name": "Strava Run", "distance": 3.1}],
    }
    res = _post(Client(), "/api/exercise/history/", payload)
    assert res.status_code == 201
    assert res.json()["workout_id"] == "run"
