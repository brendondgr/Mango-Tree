"""Agent tools for the projectmanager app.

Each tool calls the same ``backend/services/`` function as its matching DRF
view (API <-> agent parity), returns structured output via the
:class:`ToolResult` pattern. Services are injectable so the tools are
unit-testable without touching the database.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from utils.apps.projectmanager.backend.services import goals as _goals
from utils.apps.projectmanager.backend.services import projects as _projects
from utils.apps.projectmanager.shared.errors import ProjectManagerError
from utils.apps.projectmanager.shared.schemas import NewGoalDTO, NewProjectDTO


@dataclass(frozen=True)
class ToolResult:
    ok: bool
    data: dict[str, Any]
    error: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        if self.ok:
            return self.data
        return {"error": self.error or {"code": "internal_error", "message": "Tool failed"}}


def _error(exc: ProjectManagerError) -> dict[str, Any]:
    return ToolResult(
        ok=False,
        data={},
        error={"code": exc.code, "message": exc.message, "details": exc.details},
    ).to_dict()


def _denied(message: str) -> dict[str, Any]:
    return ToolResult(
        ok=False,
        data={},
        error={"code": "permission_denied", "message": message, "details": {}},
    ).to_dict()


# --- projects -----------------------------------------------------------------

def list_projects(*, service=None) -> dict[str, Any]:
    svc = service or _projects
    try:
        items = svc.list_projects()
    except ProjectManagerError as exc:
        return _error(exc)
    return {"projects": [p.to_dict() for p in items]}


def create_project(*, project: dict | None = None, service=None) -> dict[str, Any]:
    svc = service or _projects
    try:
        dto = NewProjectDTO.from_dict(project or {})
        created = svc.create_project(dto)
    except ProjectManagerError as exc:
        return _error(exc)
    return {"project": created.to_dict()}


# --- goals --------------------------------------------------------------------

def list_goals_with_deadlines(*, service=None) -> dict[str, Any]:
    svc = service or _goals
    try:
        items = svc.list_goals_with_deadlines()
    except ProjectManagerError as exc:
        return _error(exc)
    return {"goals": [g.to_dict() for g in items]}


def create_goals(*, project_id: int, goals: list[dict] | None = None, service=None) -> dict[str, Any]:
    svc = service or _goals
    try:
        dtos = [NewGoalDTO.from_dict(g) for g in (goals or [])]
        created = svc.create_goals(project_id, dtos)
    except ProjectManagerError as exc:
        return _error(exc)
    return {"goals": [g.to_dict() for g in created]}
