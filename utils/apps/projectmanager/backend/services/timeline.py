"""Timeline / Gantt domain logic. Builds timeline-item dicts from the ORM rows
and delegates range/axis/filter math to ``shared.timeline``."""

from __future__ import annotations

from typing import Optional

from django.utils import timezone

from utils.apps.projectmanager.backend.models import Goal, Project
from utils.apps.projectmanager.shared.errors import NotFoundError
from utils.apps.projectmanager.shared.timeline import (
    calculate_date_range,
    filter_timeline_items,
    parse_date,
    prepare_gantt_data,
)


def _project_item(project: Project, goals: list[Goal]) -> dict:
    total = len(goals)
    completed = sum(1 for goal in goals if goal.status == "Completed")
    progress = int((completed / total) * 100) if total else 0
    end = project.date_completed or timezone.now()
    return {
        "id": project.id,
        "name": project.title,
        "type": "project",
        "start_date": project.date_created.isoformat() if project.date_created else None,
        "end_date": end.isoformat() if end else None,
        "status": project.status,
        "category_color": project.category.color if project.category else "blue",
        "project_id": None,
        "goal_count": total,
        "progress": progress,
    }


def _goal_item(goal: Goal, category_color: str) -> dict:
    return {
        "id": goal.id,
        "name": goal.title,
        "type": "goal",
        "start_date": goal.date_created.isoformat() if goal.date_created else None,
        "end_date": goal.date_completed.isoformat() if goal.date_completed else None,
        "status": goal.status,
        "category_color": category_color,
        "project_id": goal.project_id,
    }


def _finalize(items: list[dict], dt_start, dt_end) -> dict:
    explicit = (dt_start, dt_end) if (dt_start and dt_end) else None
    date_range = calculate_date_range(items, explicit_range=explicit)
    return prepare_gantt_data(items, date_range)


def dashboard_timeline(
    *,
    status: Optional[list[str]] = None,
    item_type: Optional[str] = None,
    project_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> dict:
    projects = (
        Project.objects.select_related("category")
        .prefetch_related("goals")
        .order_by("order_index", "id")
    )
    items: list[dict] = []
    for project in projects:
        goals = list(project.goals.all())
        items.append(_project_item(project, goals))
        color = project.category.color if project.category else "blue"
        for goal in goals:
            items.append(_goal_item(goal, color))

    dt_start = parse_date(start_date)
    dt_end = parse_date(end_date)
    if status or item_type or project_id is not None or start_date or end_date:
        items = filter_timeline_items(
            items,
            date_start=dt_start,
            date_end=dt_end,
            status=status,
            project_id=project_id,
            item_type=item_type,
        )
    return _finalize(items, dt_start, dt_end)


def project_timeline(
    project_id: int,
    *,
    status: Optional[list[str]] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> dict:
    project = (
        Project.objects.select_related("category")
        .prefetch_related("goals")
        .filter(id=project_id)
        .first()
    )
    if project is None:
        raise NotFoundError(f"Project {project_id} not found", details={"id": project_id})

    goals = list(project.goals.all())
    color = project.category.color if project.category else "blue"
    items = [_project_item(project, goals)] + [_goal_item(goal, color) for goal in goals]

    dt_start = parse_date(start_date)
    dt_end = parse_date(end_date)
    if status or start_date or end_date:
        items = filter_timeline_items(
            items, date_start=dt_start, date_end=dt_end, status=status
        )
    return _finalize(items, dt_start, dt_end)
