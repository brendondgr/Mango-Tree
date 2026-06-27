"""Stage 4 verification: the DRF API over the projectmanager services, including
stable error codes and pagination. Runs against a throwaway DB copy."""

from __future__ import annotations

import json

from django.test import Client


def _post(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type="application/json")


def _patch(client, url, payload):
    return client.patch(url, data=json.dumps(payload), content_type="application/json")


# --- projects -----------------------------------------------------------------

def test_list_projects_envelope(projectmanager_db):
    res = Client().get("/api/projectmanager/projects/")
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"count", "next", "previous", "results"}
    assert body["count"] == 20


def test_create_then_list_project(projectmanager_db):
    client = Client()
    payload = {
        "title": "API Test Project",
        "category_name": "Testing",
        "category_color": "blue",
    }
    res = _post(client, "/api/projectmanager/projects/", payload)
    assert res.status_code == 201
    assert res.json()["title"] == "API Test Project"
    assert client.get("/api/projectmanager/projects/").json()["count"] == 21


def test_create_project_validation_error(projectmanager_db):
    # Missing required 'title' field
    res = _post(Client(), "/api/projectmanager/projects/", {"category_name": "Testing"})
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"


def test_get_project_detail(projectmanager_db):
    res = Client().get("/api/projectmanager/projects/1/")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == 1
    assert "title" in body
    assert "status" in body


def test_patch_project_status(projectmanager_db):
    client = Client()
    res = _patch(client, "/api/projectmanager/projects/1/", {"status": "Completed"})
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "Completed"


def test_patch_project_title_and_description(projectmanager_db):
    client = Client()
    res = _patch(
        client,
        "/api/projectmanager/projects/1/",
        {"title": "Edited Title", "description": "Edited body"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "Edited Title"
    assert body["description"] == "Edited body"


def test_patch_project_blank_title_is_validation_error(projectmanager_db):
    res = _patch(Client(), "/api/projectmanager/projects/1/", {"title": "   "})
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"


def test_delete_project_then_get_404(projectmanager_db):
    client = Client()
    res = client.delete("/api/projectmanager/projects/1/")
    assert res.status_code == 204
    res2 = client.get("/api/projectmanager/projects/1/")
    assert res2.status_code == 404
    assert res2.json()["code"] == "not_found"


# --- project goals ------------------------------------------------------------

def test_create_goals_on_project(projectmanager_db):
    payload = {
        "goals": [
            {"title": "First API Goal"},
            {"title": "Second API Goal", "deadline": "2027-01-01"},
        ]
    }
    res = _post(Client(), "/api/projectmanager/projects/1/goals/", payload)
    assert res.status_code == 201
    body = res.json()
    assert "goals" in body
    assert len(body["goals"]) == 2


def test_create_goals_on_unknown_project(projectmanager_db):
    payload = {"goals": [{"title": "Orphan Goal"}]}
    res = _post(Client(), "/api/projectmanager/projects/99999/goals/", payload)
    assert res.status_code == 404
    assert res.json()["code"] == "not_found"


def test_create_goals_missing_goals_key(projectmanager_db):
    res = _post(Client(), "/api/projectmanager/projects/1/goals/", {"title": "oops"})
    assert res.status_code == 400
    assert res.json()["code"] == "validation_error"


# --- goals --------------------------------------------------------------------

def test_goal_deadlines_envelope(projectmanager_db):
    res = Client().get("/api/projectmanager/goals/deadlines/")
    assert res.status_code == 200
    body = res.json()
    assert set(body) == {"count", "next", "previous", "results"}
    assert body["count"] == 2


def test_toggle_goal(projectmanager_db):
    client = Client()
    # Goal 6 starts as Completed; toggle should flip to Pending
    res = _post(client, "/api/projectmanager/goals/6/toggle/", {})
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == 6
    assert body["status"] == "Pending"


# --- categories ---------------------------------------------------------------

def test_categories_list(projectmanager_db):
    res = Client().get("/api/projectmanager/categories/")
    assert res.status_code == 200
    body = res.json()
    assert body["count"] == 7


# --- timeline -----------------------------------------------------------------

def test_timeline_dashboard_returns_items_and_date_axis(projectmanager_db):
    res = Client().get("/api/projectmanager/timeline/dashboard/")
    assert res.status_code == 200
    body = res.json()
    assert "items" in body
    assert "dateAxis" in body
