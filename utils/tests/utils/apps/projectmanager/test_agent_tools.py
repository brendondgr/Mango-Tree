"""Stage 5 verification: agent tools produce structured output, call the same
services as the API, and surface errors correctly."""

from __future__ import annotations

import importlib
from pathlib import Path
from unittest.mock import MagicMock

import yaml
import pytest

from django.conf import settings

from utils.apps.projectmanager.agent import tools
from utils.apps.projectmanager.shared.errors import NotFoundError
from utils.apps.projectmanager.shared.schemas import GoalDTO, ProjectDTO, CategoryDTO


# --- structured output + service delegation (mocked, no DB) -------------------

def test_list_projects_returns_structured_output():
    mock = MagicMock()
    mock.list_projects.return_value = [
        ProjectDTO(
            id=1,
            title="Test Project",
            description=None,
            status="Active",
            category=CategoryDTO(id=1, name="Projects", color="orange"),
        )
    ]
    payload = tools.list_projects(service=mock)
    assert payload["projects"][0]["id"] == 1
    assert payload["projects"][0]["title"] == "Test Project"
    mock.list_projects.assert_called_once_with()


def test_create_project_delegates_to_service():
    mock = MagicMock()
    dto = ProjectDTO(
        id=21,
        title="New Project",
        description=None,
        status="Active",
        category=CategoryDTO(id=1, name="Projects", color="orange"),
    )
    mock.create_project.return_value = dto
    payload = tools.create_project(
        project={"title": "New Project", "category_name": "Projects", "category_color": "orange"},
        service=mock,
    )
    assert payload["project"]["id"] == 21
    assert payload["project"]["title"] == "New Project"
    mock.create_project.assert_called_once()


# --- validation errors (service NOT called) -----------------------------------

def test_create_project_missing_title_returns_validation_error():
    mock = MagicMock()
    payload = tools.create_project(project={"category_name": "X"}, service=mock)
    assert payload["error"]["code"] == "validation_error"
    mock.create_project.assert_not_called()


def test_create_goals_missing_goal_title_returns_validation_error():
    mock = MagicMock()
    # goal dict missing required 'title'
    payload = tools.create_goals(
        project_id=1,
        goals=[{"deadline": "2026-09-01"}],
        service=mock,
    )
    assert payload["error"]["code"] == "validation_error"
    mock.create_goals.assert_not_called()


# --- service error surfacing --------------------------------------------------

def test_create_goals_not_found_surfaces_error():
    mock = MagicMock()
    mock.create_goals.side_effect = NotFoundError("Project 999 not found", details={"id": 999})
    payload = tools.create_goals(
        project_id=999,
        goals=[{"title": "Goal X"}],
        service=mock,
    )
    assert payload["error"]["code"] == "not_found"


# --- registry manifest consistency --------------------------------------------

def test_tools_yaml_entries_resolve():
    config = yaml.safe_load(
        (Path(settings.BASE_DIR) / "config" / "tools.yaml").read_text()
    )
    pm_tools = {
        name: meta
        for name, meta in config["tools"].items()
        if meta.get("app") == "projectmanager"
    }
    assert len(pm_tools) == 4
    for meta in pm_tools.values():
        module = importlib.import_module(meta["module"])
        assert callable(getattr(module, meta["function"]))


# --- integration against the throwaway DB copy --------------------------------

@pytest.mark.needs_legacy_data
def test_list_projects_integration():
    payload = tools.list_projects()
    assert len(payload["projects"]) == 20


@pytest.mark.needs_legacy_data
def test_list_goals_with_deadlines_integration():
    payload = tools.list_goals_with_deadlines()
    assert len(payload["goals"]) == 2


def test_create_project_integration():
    payload = tools.create_project(
        project={
            "title": "T",
            "category_name": "Projects",
            "category_color": "orange",
        }
    )
    assert "project" in payload
    assert isinstance(payload["project"]["id"], int)
    assert payload["project"]["title"] == "T"


def test_create_goals_integration():
    # first create a project to get a valid id
    created_project = tools.create_project(
        project={"title": "GoalTestProject", "category_name": "Projects", "category_color": "orange"}
    )
    project_id = created_project["project"]["id"]

    payload = tools.create_goals(
        project_id=project_id,
        goals=[{"title": "G1"}, {"title": "G2"}],
    )
    assert "goals" in payload
    assert len(payload["goals"]) == 2
    assert payload["goals"][0]["title"] == "G1"
    assert payload["goals"][1]["title"] == "G2"
