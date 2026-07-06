"""Stage 5: GET /api/tools/groups/ tool-group catalogue endpoint."""

from django.test import Client


def test_list_tool_groups_envelope():
    res = Client().get("/api/tools/groups/")
    assert res.status_code == 200
    body = res.json()
    assert "groups" in body
    by_id = {g["id"]: g for g in body["groups"]}

    # core is present, first, and on by default.
    assert body["groups"][0]["id"] == "core"
    assert by_id["core"]["default_enabled"] is True
    assert by_id["core"]["label"] == "Core"

    # An app group is present and off by default with its tools listed.
    assert by_id["mailbox"]["default_enabled"] is False
    assert "mailbox_send_message" in by_id["mailbox"]["tools"]

    # No group advertises a precondition today.
    assert all("requires" not in g for g in body["groups"])


def test_all_nine_groups_present():
    res = Client().get("/api/tools/groups/")
    ids = {g["id"] for g in res.json()["groups"]}
    assert ids == {
        "core", "media_viewer", "mailbox", "calendar", "exercise",
        "projectmanager", "imdbspy", "recipes", "timekeeper",
    }
