"""Ingredient catalog queries. Single source of truth for the API and the agent
tools."""

from __future__ import annotations

from utils.apps.recipes.backend.models import Ingredient
from utils.apps.recipes.backend.services import store
from utils.apps.recipes.shared.constants import CATEGORY_ORDER
from utils.apps.recipes.shared.schemas import IngredientDTO


def _to_dto(row: Ingredient) -> IngredientDTO:
    return IngredientDTO(id=row.id, name=row.name, category=row.category)


def list_all() -> list[IngredientDTO]:
    store.ensure_initialized()
    return [_to_dto(row) for row in Ingredient.objects.order_by("name")]


def by_category() -> dict[str, list[dict]]:
    """Group ingredients by category in the legacy display order."""
    store.ensure_initialized()
    grouped: dict[str, list[dict]] = {}
    for row in Ingredient.objects.order_by("category", "name"):
        grouped.setdefault(row.category, []).append({"id": row.id, "name": row.name})

    ordered: dict[str, list[dict]] = {}
    for category in CATEGORY_ORDER:
        if category in grouped:
            ordered[category] = grouped[category]
    for category, items in grouped.items():
        if category not in ordered:
            ordered[category] = items
    return ordered


def search(query: str, limit: int = 10) -> list[IngredientDTO]:
    """Search ingredients by substring, ranking prefix matches first (mirrors the
    legacy ``ORDER BY CASE WHEN name LIKE 'q%' ...``)."""
    store.ensure_initialized()
    if not query or not query.strip():
        return []
    needle = query.strip().lower()
    rows = list(Ingredient.objects.filter(name__icontains=needle).order_by("name"))
    prefix = [r for r in rows if r.name.lower().startswith(needle)]
    rest = [r for r in rows if not r.name.lower().startswith(needle)]
    return [_to_dto(r) for r in (prefix + rest)[:limit]]
