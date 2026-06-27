"""Goal domain logic. Single source of truth for both the DRF API and the agent
tools."""

from __future__ import annotations

from django.utils import timezone

from utils.apps.projectmanager.backend.models import Goal, Project
from utils.apps.projectmanager.shared.errors import NotFoundError, ValidationError
from utils.apps.projectmanager.shared.schemas import GoalDTO, NewGoalDTO


def _to_dto(row: Goal) -> GoalDTO:
    return GoalDTO(
        id=row.id,
        project_id=row.project_id,
        title=row.title,
        status=row.status,
        date_created=row.date_created,
        date_completed=row.date_completed,
        deadline=row.deadline,
    )


def _get_row(goal_id: int) -> Goal:
    row = Goal.objects.filter(id=goal_id).first()
    if row is None:
        raise NotFoundError(f"Goal {goal_id} not found", details={"id": goal_id})
    return row


def _require_project(project_id: int) -> Project:
    project = Project.objects.filter(id=project_id).first()
    if project is None:
        raise NotFoundError(
            f"Project {project_id} not found", details={"id": project_id}
        )
    return project


def list_goals_for_project(project_id: int) -> list[GoalDTO]:
    _require_project(project_id)
    rows = Goal.objects.filter(project_id=project_id).order_by("status", "id")
    return [_to_dto(row) for row in rows]


def list_goals_with_deadlines() -> list[GoalDTO]:
    """All goals across every project that have a deadline set, soonest first.

    Powers ``projectmanager_list_goals_with_deadlines`` — the agent uses this to
    answer "what is due / overdue" questions. Each DTO carries a
    ``deadline_status`` (overdue/warning/normal)."""
    rows = (
        Goal.objects.exclude(deadline__isnull=True)
        .order_by("deadline", "id")
    )
    return [_to_dto(row) for row in rows]


def create_goals(project_id: int, new_goals: list[NewGoalDTO]) -> list[GoalDTO]:
    """Create one or more goals on a project (each starts Pending)."""
    project = _require_project(project_id)
    if not new_goals:
        raise ValidationError("At least one goal is required", details={"field": "goals"})

    created: list[Goal] = []
    now = timezone.now()
    for new in new_goals:
        created.append(
            Goal.objects.create(
                project_id=project.id,
                title=new.title,
                status="Pending",
                date_created=now,
                deadline=new.deadline,
            )
        )
    return [_to_dto(row) for row in created]


def toggle_goal(goal_id: int) -> GoalDTO:
    """Flip a goal between Pending and Completed, maintaining ``date_completed``."""
    goal = _get_row(goal_id)
    if goal.status == "Completed":
        goal.status = "Pending"
        goal.date_completed = None
    else:
        goal.status = "Completed"
        goal.date_completed = timezone.now()
    goal.save(update_fields=["status", "date_completed"])
    return _to_dto(goal)


def update_goal(goal_id: int, *, title: str | None = None, deadline=None, clear_deadline: bool = False) -> GoalDTO:
    """Update a goal's title and/or deadline."""
    goal = _get_row(goal_id)
    if title is not None:
        cleaned = title.strip()
        if not cleaned:
            raise ValidationError("'title' must be a non-empty string", details={"field": "title"})
        goal.title = cleaned
    if clear_deadline:
        goal.deadline = None
    elif deadline is not None:
        goal.deadline = deadline
    goal.save(update_fields=["title", "deadline"])
    return _to_dto(goal)


def delete_goal(goal_id: int) -> None:
    deleted, _ = Goal.objects.filter(id=goal_id).delete()
    if not deleted:
        raise NotFoundError(f"Goal {goal_id} not found", details={"id": goal_id})
