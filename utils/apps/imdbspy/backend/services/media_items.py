"""Media-item domain services.

Single source of truth for the operations the DRF views and agent tools call.
The scraper is an injectable seam (``scraper=`` / lazy default) so callers that
add or refresh titles can be unit-tested without network I/O.
"""

from __future__ import annotations

from typing import Any

from django.db.models import Q

from utils.apps.imdbspy.backend.models import MediaItem, RatingWeights
from utils.apps.imdbspy.shared.constants import (
    DEFAULT_LIMIT,
    SCALE_TYPES,
    STATUSES,
)
from utils.apps.imdbspy.shared.errors import (
    ImdbspyError,
    NotFoundError,
    ValidationError,
)
from utils.apps.imdbspy.shared.ratings import compute_score, criteria_for


def _default_scraper():
    # Imported lazily so the service layer (and its tests, which inject a fake)
    # do not require cinemagoer to be importable.
    from utils.apps.imdbspy.backend.services.scraper import IMDbScraper

    return IMDbScraper()


def _get_item(item_id: int) -> MediaItem:
    item = MediaItem.objects.filter(id=item_id).first()
    if item is None:
        raise NotFoundError("Item not found", details={"item_id": item_id})
    return item


def _search_haystack(item: MediaItem) -> str:
    """Lowercased text of the fields the legacy /api/all search covered."""
    parts: list[str] = [item.title or ""]
    parts += [str(g) for g in (item.genres or [])]
    for collection in (item.cast, item.directors, item.creators, item.writers):
        for entry in collection or []:
            if isinstance(entry, dict):
                parts.append(str(entry.get("name", "")))
            else:
                parts.append(str(entry))
    return " ".join(parts).lower()


# --- reads --------------------------------------------------------------------

def list_media(
    *,
    status: str | None = None,
    kind: str | None = None,
    search: str | None = None,
    limit: int = DEFAULT_LIMIT,
    offset: int = 0,
) -> dict[str, Any]:
    """List tracked titles with optional filters + client-side search.

    Search spans title/genres/cast/directors/creators/writers (matching the
    original), so it filters in Python over the status/kind-narrowed set — the
    dataset is personal-scale (dozens–hundreds of rows).
    """
    try:
        limit = int(limit)
        offset = int(offset)
    except (TypeError, ValueError):
        limit, offset = DEFAULT_LIMIT, 0
    if limit < 0:
        limit = DEFAULT_LIMIT
    if offset < 0:
        offset = 0

    qs = MediaItem.objects.all()
    if status:
        qs = qs.filter(status=status)
    if kind:
        if kind == "tv":
            qs = qs.filter(Q(kind__icontains="tv") | Q(kind__icontains="series"))
        else:
            qs = qs.filter(kind__icontains=kind)
    qs = qs.order_by("-added_at")

    items = list(qs)
    term = (search or "").strip().lower()
    if term:
        items = [i for i in items if term in _search_haystack(i)]

    total = len(items)
    page = items[offset : offset + limit]
    return {
        "items": [i.to_dict() for i in page],
        "total": total,
        "has_more": (offset + limit) < total,
    }


# --- writes -------------------------------------------------------------------

def add_media(urls: Any, *, scraper: Any = None) -> dict[str, Any]:
    """Scrape one or more IMDb URLs/IDs and insert new titles.

    Batch semantics: partial success is expected when a user pastes several
    links, so per-item failures are collected (with a stable ``code``) rather
    than aborting the whole batch.
    """
    if scraper is None:
        scraper = _default_scraper()

    if isinstance(urls, str):
        urls = [urls]
    if not urls or not isinstance(urls, (list, tuple)):
        raise ValidationError("No URLs provided", details={"urls": urls})

    added: list[MediaItem] = []
    errors: list[dict[str, str]] = []

    for url in urls:
        try:
            result = scraper.run(url)

            if not getattr(result, "imdb_id", None):
                raise ValidationError(f"Scraper returned no IMDb ID for {url}")

            title = result.title or "Unknown Title"
            kind = result.kind or "movie"

            if "episode" in kind.lower():
                errors.append(
                    {
                        "url": str(url),
                        "code": "validation_error",
                        "message": (
                            f"Cannot add individual episodes: {title} "
                            f"({result.imdb_id}). Please add the full TV Series."
                        ),
                    }
                )
                continue

            if MediaItem.objects.filter(imdb_id=result.imdb_id).exists():
                errors.append(
                    {
                        "url": str(url),
                        "code": "conflict",
                        "message": f"Item already exists: {title} ({result.imdb_id})",
                    }
                )
                continue

            item = MediaItem.objects.create(
                imdb_id=result.imdb_id,
                title=title,
                description=result.description,
                kind=kind,
                genres=result.genres,
                rating=result.rating,
                rating_count=result.rating_count,
                creators=result.creators,
                seasons=result.seasons,
                episodes=result.episodes,
                years=result.years,
                directors=result.directors,
                writers=result.writers,
                runtime_minutes=result.runtime_minutes,
                cast=result.cast,
                title_image_path=result.title_image_path,
                actor_image_paths=result.actor_image_paths,
                status="not_seen",
            )
            added.append(item)

        except ImdbspyError as exc:
            errors.append({"url": str(url), "code": exc.code, "message": exc.message})
        except Exception as exc:  # scraper/network failures stay per-item
            errors.append(
                {"url": str(url), "code": "internal_error", "message": str(exc)}
            )

    return {"added": [i.to_dict() for i in added], "errors": errors}


def set_status(item_id: int, status: str) -> MediaItem:
    if status not in STATUSES:
        raise ValidationError("Invalid status", details={"status": status})
    item = _get_item(item_id)
    item.status = status
    item.save(update_fields=["status"])
    return item


def update_review(
    item_id: int,
    *,
    scale_type: str | None = None,
    ratings: dict[str, Any] | None = None,
    user_rating: float | None = None,
    user_review: str | None = None,
    seasons_seen: int | None = None,
) -> MediaItem:
    """Update a title's weighted rating, freeform review, and/or seasons seen.

    When ``scale_type`` is given the 0–10 ``user_rating`` is computed from the
    per-criterion ratings and that scale's weights (single source of truth in
    ``shared/ratings``). A bare ``user_rating`` is only honored when no scale is
    supplied (legacy direct-edit path). Seasons are ignored for movies here.
    """
    item = _get_item(item_id)

    if scale_type is not None:
        if scale_type not in SCALE_TYPES:
            raise ValidationError("Invalid scale_type", details={"scale_type": scale_type})
        weights = RatingWeights.objects.filter(scale_type=scale_type).first()
        if weights is None:
            raise ImdbspyError("Weights configuration not found for scale type")

        supplied = ratings or {}

        def clamp(value: Any) -> float:
            try:
                return max(0.0, min(5.0, float(value)))
            except (TypeError, ValueError):
                return 0.0

        item.scale_type = scale_type
        for criterion in criteria_for(scale_type):
            setattr(item, f"{criterion}_rating", clamp(supplied.get(f"{criterion}_rating")))

        item.user_rating = compute_score(
            scale_type,
            lambda c: getattr(item, f"{c}_rating"),
            lambda c: getattr(weights, f"{c}_weight"),
        )
    elif user_rating is not None:
        if not isinstance(user_rating, (int, float)) or not (0 <= user_rating <= 10):
            raise ValidationError("user_rating must be between 0 and 10")
        item.user_rating = float(user_rating)

    if user_review is not None:
        item.user_review = str(user_review)

    if seasons_seen is not None and item.kind != "movie":
        if not isinstance(seasons_seen, int) or seasons_seen < 0:
            raise ValidationError("Invalid seasons_seen value")
        if item.seasons and seasons_seen > item.seasons:
            raise ValidationError(
                f"seasons_seen cannot exceed total seasons ({item.seasons})"
            )
        item.seasons_seen = seasons_seen

    item.save()
    return item


def update_seasons_seen(item_id: int, seasons_seen: int | None) -> MediaItem:
    item = _get_item(item_id)
    if item.kind == "movie":
        raise ValidationError("Cannot set seasons for movies")
    if seasons_seen is not None:
        if not isinstance(seasons_seen, int) or seasons_seen < 0:
            raise ValidationError("Invalid seasons_seen value")
        if item.seasons and seasons_seen > item.seasons:
            raise ValidationError(
                f"seasons_seen cannot exceed total seasons ({item.seasons})"
            )
    item.seasons_seen = seasons_seen
    item.save(update_fields=["seasons_seen"])
    return item


def delete_media(item_id: int) -> None:
    item = _get_item(item_id)
    item.delete()


def refresh_all(*, scraper: Any = None) -> dict[str, Any]:
    """Refresh metadata (rating/years/seasons/episodes) for all items.

    Does not re-download images. Per-item failures are collected.
    """
    if scraper is None:
        scraper = _default_scraper()

    updated: list[dict[str, str]] = []
    errors: list[dict[str, str]] = []

    for item in MediaItem.objects.all():
        try:
            meta = scraper.refresh_metadata(item.imdb_id)
            if meta.get("years"):
                item.years = meta["years"]
            if meta.get("rating") is not None:
                item.rating = meta["rating"]
            if meta.get("rating_count") is not None:
                item.rating_count = meta["rating_count"]
            if meta.get("seasons") is not None:
                item.seasons = meta["seasons"]
            if meta.get("episodes") is not None:
                item.episodes = meta["episodes"]
            item.save()
            updated.append({"imdb_id": item.imdb_id, "title": item.title})
        except Exception as exc:
            errors.append({"imdb_id": item.imdb_id, "error": str(exc)})

    return {"updated_count": len(updated), "updated": updated, "errors": errors}
