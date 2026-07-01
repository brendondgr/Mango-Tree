"""Agent tools for the IMDbSpy app.

Each tool calls the same ``backend/services/`` function as its matching DRF view
(API <-> agent parity), returns structured output via the :class:`ToolResult`
pattern, and confirm-gates the destructive delete. The service (and, for the
scraping tools, the scraper) are injectable so the tools are unit-testable
without a database or network access.

Rating-weights are deliberately **not** exposed as tools — they are a UI/API
configuration surface (see the app README).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from utils.apps.imdbspy.backend.services import media_items as _media_items
from utils.apps.imdbspy.shared.errors import ImdbspyError


@dataclass(frozen=True)
class ToolResult:
    ok: bool
    data: dict[str, Any]
    error: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        if self.ok:
            return self.data
        return {"error": self.error or {"code": "internal_error", "message": "Tool failed"}}


def _error(exc: ImdbspyError) -> dict[str, Any]:
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


def list_media(
    *,
    status: str | None = None,
    kind: str | None = None,
    search: str | None = None,
    limit: int | None = None,
    offset: int = 0,
    service=None,
) -> dict[str, Any]:
    """List tracked titles (`{items, total, has_more}`)."""
    svc = service or _media_items
    kwargs: dict[str, Any] = {"status": status, "kind": kind, "search": search, "offset": offset}
    if limit is not None:
        kwargs["limit"] = limit
    try:
        return svc.list_media(**kwargs)
    except ImdbspyError as exc:
        return _error(exc)


def add_media(*, urls: Any, scraper=None, service=None) -> dict[str, Any]:
    """Scrape one or more IMDb URLs/IDs and add them (`{added, errors}`)."""
    svc = service or _media_items
    try:
        return svc.add_media(urls, scraper=scraper)
    except ImdbspyError as exc:
        return _error(exc)


def set_status(*, item_id: int, status: str, service=None) -> dict[str, Any]:
    """Set a title's status (seen / not_seen / abandoned)."""
    svc = service or _media_items
    try:
        item = svc.set_status(item_id, status)
    except ImdbspyError as exc:
        return _error(exc)
    return {"item": item.to_dict()}


def update_review(
    *,
    item_id: int,
    scale_type: str | None = None,
    ratings: dict[str, Any] | None = None,
    user_rating: float | None = None,
    user_review: str | None = None,
    seasons_seen: int | None = None,
    service=None,
) -> dict[str, Any]:
    """Update a title's weighted rating, review, and/or seasons seen.

    ``ratings`` is a dict of ``<criterion>_rating`` values (0–5) for the chosen
    ``scale_type`` (fun/grit/comfort); the 0–10 ``user_rating`` is computed.
    """
    svc = service or _media_items
    try:
        item = svc.update_review(
            item_id,
            scale_type=scale_type,
            ratings=ratings,
            user_rating=user_rating,
            user_review=user_review,
            seasons_seen=seasons_seen,
        )
    except ImdbspyError as exc:
        return _error(exc)
    return {"item": item.to_dict()}


def delete_media(*, item_id: int, confirm: bool = False, service=None) -> dict[str, Any]:
    """Delete a title. Irreversible — requires ``confirm: true``."""
    if confirm is not True:
        return _denied("Deleting a title requires confirm: true")
    svc = service or _media_items
    try:
        svc.delete_media(item_id)
    except ImdbspyError as exc:
        return _error(exc)
    return {"deleted": True}


def refresh_metadata(*, scraper=None, service=None) -> dict[str, Any]:
    """Refresh metadata (rating/years/seasons/episodes) for all titles."""
    svc = service or _media_items
    try:
        return svc.refresh_all(scraper=scraper)
    except ImdbspyError as exc:
        return _error(exc)
