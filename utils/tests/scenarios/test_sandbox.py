"""The sandbox must give every group a working store before any scenario runs."""

from __future__ import annotations

import pytest

from utils.agents.tools.registry import registry
from utils.tests.scenarios import harness as h

LIST_TOOL_BY_GROUP = {
    "core": ("list_artifacts", {}),
    "exercise": ("exercise_list_workouts", {}),
    "recipes": ("recipes_list_recipes", {}),
    "imdbspy": ("imdbspy_list_media", {}),
    "timekeeper": ("timekeeper_list_categories", {}),
    "calendar": ("calendar_list_schedules", {}),
    "projectmanager": ("projectmanager_list_projects", {}),
    "media_viewer": ("media_viewer_list_artifacts", {}),
    "mailbox": ("mailbox_list_accounts", {}),
}


@pytest.mark.parametrize("group", sorted(LIST_TOOL_BY_GROUP))
def test_every_group_reads_from_the_sandbox(sandbox, group):
    tool, args = LIST_TOOL_BY_GROUP[group]
    result = registry.execute(tool, args, enabled_groups=[group])
    assert result.success, result.summary
    assert h.classify({"success": True, "result": result.result, "summary": result.summary}) == h.OK


def test_seeded_rows_are_visible_to_the_tools(sandbox):
    workouts = registry.execute("exercise_list_workouts", {}).result["workouts"]
    assert any(w["id"] == sandbox.seed("exercise", "workout_id") for w in workouts)

    media = registry.execute("imdbspy_list_media", {}).result
    assert media["total"] == 2

    cats = registry.execute("timekeeper_list_categories", {}).result["categories"]
    assert any(c["id"] == "scn_work" for c in cats)

    projects = registry.execute("projectmanager_list_projects", {}).result["projects"]
    assert any(p["id"] == sandbox.seed("projectmanager", "project_id") for p in projects)

    recipes = registry.execute("recipes_list_recipes", {}).result["recipes"]
    assert len(recipes) == sandbox.seed("recipes", "recipe_count") > 0

    upcoming = registry.execute("calendar_list_upcoming", {"days_ahead": 3}).result
    assert any(e["title"] == "Scenario Dentist" for e in upcoming["events"])

    accounts = registry.execute("mailbox_list_accounts", {}).result["accounts"]
    assert accounts[0]["id"] == sandbox.seed("mailbox", "account_id")


def test_core_and_media_viewer_share_the_artifact_store(sandbox):
    """The core read_artifact tool must see what media_viewer_save_artifact wrote."""
    listed = registry.execute("list_artifacts", {}).result["artifacts"]
    ids = {a["id"] for a in listed}
    assert sandbox.seed("artifacts", "note_id") in ids

    read = registry.execute("read_artifact", {"artifact_id": sandbox.seed("artifacts", "note_id")})
    assert read.success and "water the tomatoes" in read.result["content"]

    image = registry.execute("read_artifact", {"artifact_id": sandbox.seed("artifacts", "image_id")})
    assert image.success and image.result.get("media_type") == "image"


def test_network_seams_are_faked(sandbox):
    strava = registry.execute("exercise_sync_strava", {"period": "week"})
    assert strava.success and strava.result["strava_sync"]["imported"] == 2
    assert sandbox.strava.calls == ["week"]

    added = registry.execute("imdbspy_add_media", {"urls": ["tt0068646"]}).result
    assert [a["title"] for a in added["added"]] == ["The Godfather"], added
    assert sandbox.scraper.run_calls

    search = registry.execute("search_web", {"query": "latest django lts"})
    assert search.success and len(search.result["sources"]) == 2
    assert sandbox.research.queries == ["latest django lts"]

    inbox = registry.execute(
        "mailbox_list_messages", {"account": sandbox.seed("mailbox", "account_id")}
    ).result
    assert inbox["count"] == 3
    assert sandbox.mail.calls[-1]["op"] == "list_messages"


def test_live_data_is_never_touched(sandbox, settings):
    """Belt and braces: every DB alias points inside the sandbox's tmp dir."""
    from django.db import connections

    for alias in ("exercise", "projectmanager", "timekeeper", "imdbspy", "recipes"):
        name = connections[alias].settings_dict["NAME"]
        assert str(sandbox.root.parent) in str(name), (alias, name)
