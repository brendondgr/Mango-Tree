"""Agent tools for the timekeeper app.

Each tool calls the same ``backend/services/`` function as its matching DRF view
(API <-> agent parity) and returns structured output via the :class:`ToolResult`
pattern. Services are injectable so the tools are unit-testable without touching
the database. State-changing tools (``save_day``, ``delete_log``) require explicit
``confirm=True`` because they overwrite / remove existing data.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from utils.apps.timekeeper.backend.services import categories as _categories
from utils.apps.timekeeper.backend.services import logs as _logs
from utils.apps.timekeeper.shared.errors import TimekeeperError


@dataclass(frozen=True)
class ToolResult:
    ok: bool
    data: dict[str, Any]
    error: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        if self.ok:
            return self.data
        return {"error": self.error or {"code": "internal_error", "message": "Tool failed"}}


def _error(exc: TimekeeperError) -> dict[str, Any]:
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


# --- reads --------------------------------------------------------------------

def list_logs(*, date: str | None = None, service=None) -> dict[str, Any]:
    svc = service or _logs
    try:
        items = svc.list_logs(date=date)
    except TimekeeperError as exc:
        return _error(exc)
    return {"logs": [dto.to_dict() for dto in items]}


def daily_totals(*, service=None) -> dict[str, Any]:
    svc = service or _logs
    try:
        days = svc.daily_totals()
    except TimekeeperError as exc:
        return _error(exc)
    return {"days": days}


def list_categories(*, service=None) -> dict[str, Any]:
    svc = service or _categories
    try:
        categories = svc.get_categories()
    except TimekeeperError as exc:
        return _error(exc)
    return {"categories": categories}


# --- writes (confirm-gated) ---------------------------------------------------

def save_day(
    *,
    date: str,
    intervals: list[dict] | None = None,
    confirm: bool = False,
    service=None,
) -> dict[str, Any]:
    """Replace a day's logs. Overwrites any existing logs for ``date``, so it
    requires ``confirm=True``."""
    if confirm is not True:
        return _denied(
            "save_day overwrites the whole day and requires confirm: true"
        )
    svc = service or _logs
    try:
        saved = svc.save_day(date, intervals or [])
    except TimekeeperError as exc:
        return _error(exc)
    return {"date": date, "logs": [dto.to_dict() for dto in saved], "saved": len(saved)}


def delete_log(*, log_id: int, confirm: bool = False, service=None) -> dict[str, Any]:
    """Delete a single log row. Requires ``confirm=True``."""
    if confirm is not True:
        return _denied("Deletion requires confirm: true")
    svc = service or _logs
    try:
        svc.delete_log(log_id)
    except TimekeeperError as exc:
        return _error(exc)
    return {"deleted": True, "log_id": log_id}
