"""Data transfer objects shared by the services, DRF API, and agent tools.

Read DTOs (``CategoryDTO``, ``ProjectDTO``, ``GoalDTO``) own ``to_dict`` — the
JSON shape returned by both the API and the agent tools. Input DTOs
(``NewProjectDTO``, ``NewGoalDTO``) own ``from_dict`` — the single validation
entry point, raising the app's typed :class:`ValidationError`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from utils.apps.projectmanager.shared.constants import (
    CATEGORY_COLORS,
    DEFAULT_CATEGORY_COLOR,
    PROJECT_STATUSES,
)
from utils.apps.projectmanager.shared.deadline import get_deadline_status
from utils.apps.projectmanager.shared.errors import ValidationError


# --- validation helpers -------------------------------------------------------

def _req_str(data: dict, key: str, *, max_len: int | None = None) -> str:
    value = data.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(
            f"'{key}' is required and must be a non-empty string",
            details={"field": key},
        )
    value = value.strip()
    if max_len is not None and len(value) > max_len:
        raise ValidationError(
            f"'{key}' must be at most {max_len} characters",
            details={"field": key},
        )
    return value


def _opt_str(data: dict, key: str) -> Optional[str]:
    value = data.get(key)
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValidationError(f"'{key}' must be a string", details={"field": key})
    return value


def _parse_dt(data: dict, key: str) -> Optional[datetime]:
    """Parse an optional ISO datetime/date string into an aware UTC datetime."""
    value = data.get(key)
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        text = value.strip()
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(text)
        except ValueError:
            raise ValidationError(
                f"'{key}' must be an ISO 8601 date or datetime",
                details={"field": key},
            )
    else:
        raise ValidationError(f"'{key}' must be a date string", details={"field": key})
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt is not None else None


# --- read DTOs ----------------------------------------------------------------

@dataclass(frozen=True)
class CategoryDTO:
    name: str
    color: str
    id: Optional[int] = None

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "name": self.name, "color": self.color}


@dataclass(frozen=True)
class GoalDTO:
    id: int
    project_id: int
    title: str
    status: str
    date_created: Optional[datetime] = None
    date_completed: Optional[datetime] = None
    deadline: Optional[datetime] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "project_id": self.project_id,
            "title": self.title,
            "status": self.status,
            "date_created": _iso(self.date_created),
            "date_completed": _iso(self.date_completed),
            "deadline": _iso(self.deadline),
            "deadline_status": get_deadline_status(self.deadline),
        }


@dataclass(frozen=True)
class ProjectDTO:
    id: int
    title: str
    description: Optional[str]
    status: str
    category: Optional[CategoryDTO]
    progress: int = 0
    order_index: int = 0
    goal_count: int = 0
    completed_goal_count: int = 0
    date_created: Optional[datetime] = None
    date_completed: Optional[datetime] = None
    date_on_hold: Optional[datetime] = None
    date_abandoned: Optional[datetime] = None
    deadline: Optional[datetime] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status,
            "category": self.category.to_dict() if self.category else None,
            "progress": self.progress,
            "order_index": self.order_index,
            "goal_count": self.goal_count,
            "completed_goal_count": self.completed_goal_count,
            "date_created": _iso(self.date_created),
            "date_completed": _iso(self.date_completed),
            "date_on_hold": _iso(self.date_on_hold),
            "date_abandoned": _iso(self.date_abandoned),
            "deadline": _iso(self.deadline),
            "deadline_status": get_deadline_status(self.deadline),
        }


# --- input DTOs ---------------------------------------------------------------

@dataclass(frozen=True)
class NewProjectDTO:
    title: str
    category_name: str
    category_color: str = DEFAULT_CATEGORY_COLOR
    description: Optional[str] = None
    status: str = "Active"
    deadline: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: dict) -> "NewProjectDTO":
        if not isinstance(data, dict):
            raise ValidationError("project must be an object")
        color = _opt_str(data, "category_color") or DEFAULT_CATEGORY_COLOR
        if color not in CATEGORY_COLORS:
            raise ValidationError(
                f"'category_color' must be one of {', '.join(CATEGORY_COLORS)}",
                details={"field": "category_color"},
            )
        status = _opt_str(data, "status") or "Active"
        if status not in PROJECT_STATUSES:
            raise ValidationError(
                f"'status' must be one of {', '.join(PROJECT_STATUSES)}",
                details={"field": "status"},
            )
        return cls(
            title=_req_str(data, "title", max_len=100),
            category_name=_req_str(data, "category_name", max_len=50),
            category_color=color,
            description=_opt_str(data, "description"),
            status=status,
            deadline=_parse_dt(data, "deadline"),
        )


@dataclass(frozen=True)
class NewGoalDTO:
    title: str
    deadline: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: dict) -> "NewGoalDTO":
        if not isinstance(data, dict):
            raise ValidationError("goal must be an object")
        return cls(
            title=_req_str(data, "title", max_len=200),
            deadline=_parse_dt(data, "deadline"),
        )
