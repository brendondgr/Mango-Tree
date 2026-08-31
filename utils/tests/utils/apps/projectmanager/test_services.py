"""Stage 3 verification: ported domain services, including validation and
not-found cases. Runs against a per-test throwaway copy of the real database."""

from __future__ import annotations

import pytest

from utils.apps.projectmanager.backend.models import Category, Goal
from utils.apps.projectmanager.backend.services import categories as category_service
from utils.apps.projectmanager.backend.services import goals as goal_service
from utils.apps.projectmanager.backend.services import projects as project_service
from utils.apps.projectmanager.backend.services import timeline as timeline_service
from utils.apps.projectmanager.shared.errors import NotFoundError, ValidationError
from utils.apps.projectmanager.shared.schemas import (
    NewGoalDTO,
    NewProjectDTO,
    ProjectDTO,
)


# --- projects -----------------------------------------------------------------

@pytest.mark.needs_legacy_data
def test_list_projects_returns_dtos_baseline():
    projects = project_service.list_projects()
    assert len(projects) == 20
    assert all(isinstance(p, ProjectDTO) for p in projects)
    # ordered by order_index then id (stable)
    assert [p.order_index for p in projects] == sorted(p.order_index for p in projects)


@pytest.mark.needs_legacy_data
def test_get_project_includes_category_and_progress():
    project = project_service.get_project(1)
    assert project.title == "Calendar (Project Peach)"
    assert project.category.name == "Projects"
    assert project.category.color == "orange"
    assert 0 <= project.progress <= 100
    assert project.goal_count >= project.completed_goal_count


def test_get_missing_project_raises_not_found():
    with pytest.raises(NotFoundError):
        project_service.get_project(999999)


@pytest.mark.needs_legacy_data
def test_create_project_appends_and_reuses_category():
    before = project_service.list_projects()
    max_order = max(p.order_index for p in before)
    dto = NewProjectDTO.from_dict(
        {"title": "Brand New", "category_name": "Projects", "category_color": "orange"}
    )
    created = project_service.create_project(dto)
    assert created.title == "Brand New"
    assert created.status == "Active"
    assert created.progress == 0
    assert created.order_index == max_order + 1
    # reused the existing "Projects" category — no new row
    assert Category.objects.filter(name="Projects").count() == 1
    assert len(project_service.list_projects()) == 21


def test_create_project_makes_new_category_and_updates_color():
    # New category name -> created
    project_service.create_project(
        NewProjectDTO.from_dict(
            {"title": "P1", "category_name": "FreshCat", "category_color": "teal"}
        )
    )
    assert Category.objects.get(name="FreshCat").color == "teal"
    # Same name, different colour -> colour updated globally
    project_service.create_project(
        NewProjectDTO.from_dict(
            {"title": "P2", "category_name": "FreshCat", "category_color": "pink"}
        )
    )
    assert Category.objects.get(name="FreshCat").color == "pink"
    assert Category.objects.filter(name="FreshCat").count() == 1


@pytest.mark.needs_legacy_data
def test_update_status_sets_and_clears_lifecycle_dates():
    completed = project_service.update_status(1, "Completed")
    assert completed.status == "Completed"
    assert completed.date_completed is not None
    active = project_service.update_status(1, "Active")
    assert active.status == "Active"
    assert active.date_completed is None


@pytest.mark.needs_legacy_data
def test_update_status_rejects_unknown_status():
    with pytest.raises(ValidationError):
        project_service.update_status(1, "Frozen")


@pytest.mark.needs_legacy_data
def test_update_project_edits_title_and_description():
    updated = project_service.update_project(
        1, title="Renamed Project", description="New blurb"
    )
    assert updated.title == "Renamed Project"
    assert updated.description == "New blurb"
    # status untouched when not supplied
    assert updated.status == project_service.get_project(1).status


@pytest.mark.needs_legacy_data
def test_update_project_blank_description_clears_it():
    updated = project_service.update_project(1, description="   ")
    assert updated.description is None


@pytest.mark.needs_legacy_data
def test_update_project_blank_title_raises():
    with pytest.raises(ValidationError):
        project_service.update_project(1, title="   ")


@pytest.mark.needs_legacy_data
def test_update_project_combined_title_and_status():
    updated = project_service.update_project(
        1, title="Combo", status="Completed"
    )
    assert updated.title == "Combo"
    assert updated.status == "Completed"
    assert updated.date_completed is not None


def test_update_project_unknown_raises_not_found():
    with pytest.raises(NotFoundError):
        project_service.update_project(999999, title="x")


@pytest.mark.needs_legacy_data
def test_delete_project_removes_project_and_goals():
    goal_count = Goal.objects.filter(project_id=1).count()
    assert goal_count > 0
    project_service.delete_project(1)
    with pytest.raises(NotFoundError):
        project_service.get_project(1)
    assert Goal.objects.filter(project_id=1).count() == 0


# --- categories ---------------------------------------------------------------

def test_resolve_or_create_is_idempotent_on_name():
    a = category_service.resolve_or_create("Projects", "orange")
    b = category_service.resolve_or_create("Projects", "orange")
    assert a.id == b.id
    assert Category.objects.filter(name="Projects").count() == 1


# --- goals --------------------------------------------------------------------

@pytest.mark.needs_legacy_data
def test_list_goals_with_deadlines_sorted_and_filtered():
    goals = goal_service.list_goals_with_deadlines()
    assert len(goals) == 2
    assert all(g.deadline is not None for g in goals)
    # soonest deadline first
    assert [g.deadline for g in goals] == sorted(g.deadline for g in goals)
    # deadline_status is surfaced in the serialized shape
    assert goals[0].to_dict()["deadline_status"] is not None


@pytest.mark.needs_legacy_data
def test_create_goals_adds_pending_goals_to_project():
    created = goal_service.create_goals(
        1,
        [
            NewGoalDTO.from_dict({"title": "Ship v1"}),
            NewGoalDTO.from_dict({"title": "Write docs", "deadline": "2026-09-01"}),
        ],
    )
    assert len(created) == 2
    assert all(g.status == "Pending" for g in created)
    assert created[1].deadline is not None
    assert Goal.objects.filter(project_id=1).count() >= 2


def test_create_goals_unknown_project_raises_not_found():
    with pytest.raises(NotFoundError):
        goal_service.create_goals(999999, [NewGoalDTO.from_dict({"title": "X"})])


@pytest.mark.needs_legacy_data
def test_create_goals_empty_list_raises_validation():
    with pytest.raises(ValidationError):
        goal_service.create_goals(1, [])


@pytest.mark.needs_legacy_data
def test_toggle_goal_flips_status_and_completion():
    goal = goal_service.list_goals_for_project(1)[0]
    toggled = goal_service.toggle_goal(goal.id)
    assert toggled.status in {"Pending", "Completed"}
    if toggled.status == "Completed":
        assert toggled.date_completed is not None
    again = goal_service.toggle_goal(goal.id)
    assert again.status != toggled.status


def test_list_goals_for_unknown_project_raises():
    with pytest.raises(NotFoundError):
        goal_service.list_goals_for_project(999999)


# --- timeline -----------------------------------------------------------------

@pytest.mark.needs_legacy_data
def test_dashboard_timeline_includes_projects_and_goals():
    data = timeline_service.dashboard_timeline()
    assert set(data) == {"items", "dateAxis", "minDate", "maxDate", "zoomLevel"}
    # 20 projects + 87 goals
    assert len(data["items"]) == 107
    assert {item["type"] for item in data["items"]} == {"project", "goal"}


@pytest.mark.needs_legacy_data
def test_project_timeline_scopes_to_one_project():
    data = timeline_service.project_timeline(1)
    types = [item["type"] for item in data["items"]]
    assert types.count("project") == 1
    # only this project's goals are present
    assert all(
        item["project_id"] in (None, 1) for item in data["items"]
    )


def test_project_timeline_unknown_raises():
    with pytest.raises(NotFoundError):
        timeline_service.project_timeline(999999)
