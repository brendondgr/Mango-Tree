"""Project domain logic. Single source of truth for both the DRF API and the
agent tools."""

from __future__ import annotations

from django.db.models import Max
from django.utils import timezone

from utils.apps.projectmanager.backend.models import Goal, Project
from utils.apps.projectmanager.backend.services import categories as category_service
from utils.apps.projectmanager.shared.constants import (
    PROJECT_STATUSES,
    STATUS_TIMESTAMP_FIELD,
)
from utils.apps.projectmanager.shared.errors import NotFoundError, ValidationError
from utils.apps.projectmanager.shared.schemas import (
    CategoryDTO,
    NewProjectDTO,
    ProjectDTO,
)


def _to_dto(project: Project, *, goals: list[Goal] | None = None) -> ProjectDTO:
    goal_list = list(project.goals.all()) if goals is None else goals
    total = len(goal_list)
    completed = sum(1 for goal in goal_list if goal.status == "Completed")
    progress = int((completed / total) * 100) if total else 0
    category = project.category
    return ProjectDTO(
        id=project.id,
        title=project.title,
        description=project.description,
        status=project.status,
        category=CategoryDTO(id=category.id, name=category.name, color=category.color)
        if category is not None
        else None,
        progress=progress,
        order_index=project.order_index or 0,
        goal_count=total,
        completed_goal_count=completed,
        date_created=project.date_created,
        date_completed=project.date_completed,
        date_on_hold=project.date_on_hold,
        date_abandoned=project.date_abandoned,
        deadline=project.deadline,
    )


def _queryset():
    return (
        Project.objects.select_related("category")
        .prefetch_related("goals")
        .order_by("order_index", "id")
    )


def _get_row(project_id: int) -> Project:
    row = Project.objects.select_related("category").filter(id=project_id).first()
    if row is None:
        raise NotFoundError(f"Project {project_id} not found", details={"id": project_id})
    return row


def list_projects() -> list[ProjectDTO]:
    return [_to_dto(project) for project in _queryset()]


def get_project(project_id: int) -> ProjectDTO:
    return _to_dto(_get_row(project_id))


def create_project(new: NewProjectDTO) -> ProjectDTO:
    """Create a project, resolving (or creating) its category and appending it to
    the end of the board, exactly as the legacy app did."""
    category = category_service.resolve_or_create(new.category_name, new.category_color)
    max_order = Project.objects.aggregate(value=Max("order_index"))["value"] or 0

    fields = {
        "title": new.title,
        "description": new.description,
        "status": new.status,
        "category": category,
        "order_index": max_order + 1,
        "progress": 0,
        "date_created": timezone.now(),
        "deadline": new.deadline,
    }
    # A non-Active status at creation stamps its matching lifecycle timestamp.
    timestamp_field = STATUS_TIMESTAMP_FIELD.get(new.status)
    if timestamp_field:
        fields[timestamp_field] = timezone.now()

    project = Project.objects.create(**fields)
    return _to_dto(project, goals=[])


# Sentinel so callers can distinguish "field omitted" from "set to None/empty".
_UNSET: object = object()


def update_project(
    project_id: int,
    *,
    title=_UNSET,
    description=_UNSET,
    status=_UNSET,
) -> ProjectDTO:
    """Update any subset of a project's title, description, and status.

    Only the fields actually supplied are written. Status changes mirror the
    legacy lifecycle-timestamp rules: moving back to Active clears all lifecycle
    dates; a terminal status stamps its own date. Description is normalised so an
    empty/whitespace value clears it.
    """
    project = _get_row(project_id)
    fields: list[str] = []

    if title is not _UNSET:
        cleaned = (title or "").strip()
        if not cleaned:
            raise ValidationError(
                "'title' is required and must be a non-empty string",
                details={"field": "title"},
            )
        project.title = cleaned
        fields.append("title")

    if description is not _UNSET:
        project.description = (
            description.strip()
            if isinstance(description, str) and description.strip()
            else None
        )
        fields.append("description")

    if status is not _UNSET:
        if status not in PROJECT_STATUSES:
            raise ValidationError(
                f"'status' must be one of {', '.join(PROJECT_STATUSES)}",
                details={"field": "status"},
            )
        project.status = status
        now = timezone.now()
        if status == "Completed":
            project.date_completed = now
        elif status == "On-Hold":
            project.date_on_hold = now
        elif status == "Abandoned":
            project.date_abandoned = now
        else:  # Active
            project.date_completed = None
            project.date_on_hold = None
            project.date_abandoned = None
        fields += ["status", "date_completed", "date_on_hold", "date_abandoned"]

    if fields:
        # dict.fromkeys preserves order while de-duplicating.
        project.save(update_fields=list(dict.fromkeys(fields)))
    return _to_dto(project)


def update_status(project_id: int, status: str) -> ProjectDTO:
    """Thin wrapper over :func:`update_project` for status-only changes."""
    return update_project(project_id, status=status)


def delete_project(project_id: int) -> None:
    """Delete a project and its goals (legacy app-level cascade)."""
    project = _get_row(project_id)
    Goal.objects.filter(project_id=project.id).delete()
    project.delete()
