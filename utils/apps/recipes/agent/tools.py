"""Agent tools for the recipes app.

Each tool is a thin, keyword-only wrapper that calls the SAME ``backend/services``
functions the DRF API calls (API <-> agent parity) and returns a structured
``ToolResult`` envelope. Services are injectable so tools are unit-testable
without a database. Destructive operations require ``confirm=True``, checked here
in code (never in the prompt)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from utils.apps.recipes.backend.services import ingredients as _ingredients
from utils.apps.recipes.backend.services import recipes as _recipes
from utils.apps.recipes.shared.errors import RecipesError
from utils.apps.recipes.shared.schemas import NewRecipeDTO


@dataclass(frozen=True)
class ToolResult:
    ok: bool
    data: dict[str, Any]
    error: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        if self.ok:
            return self.data
        return {"error": self.error or {"code": "internal_error", "message": "Tool failed"}}


def _error(exc: RecipesError) -> dict[str, Any]:
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


def list_recipes(*, service=None) -> dict[str, Any]:
    svc = service or _recipes
    try:
        items = svc.list_all()
    except RecipesError as exc:
        return _error(exc)
    return {"recipes": [r.to_dict() for r in items]}


def get_recipe(*, recipe_id: int, service=None) -> dict[str, Any]:
    svc = service or _recipes
    try:
        recipe = svc.get_by_id(recipe_id)
    except RecipesError as exc:
        return _error(exc)
    return {"recipe": recipe.to_dict()}


def list_ingredients(*, service=None) -> dict[str, Any]:
    svc = service or _ingredients
    try:
        items = svc.list_all()
    except RecipesError as exc:
        return _error(exc)
    return {"ingredients": [i.to_dict() for i in items]}


def find_by_ingredients(
    *,
    ingredient_names: list[str] | None = None,
    ingredient_ids: list[int] | None = None,
    meal_types: list[str] | None = None,
    cuisine_regions: list[str] | None = None,
    service=None,
    ingredients=None,
) -> dict[str, Any]:
    """Rank recipes by how well they match a pantry described by ingredient names
    and/or ids, optionally constrained to meal types / cuisine regions."""
    svc = service or _recipes
    ing = ingredients or _ingredients
    try:
        pantry_ids = list(ingredient_ids or [])
        if ingredient_names:
            wanted = {n.strip().lower() for n in ingredient_names if n and n.strip()}
            catalog = ing.list_all()
            pantry_ids += [row.id for row in catalog if row.name.lower() in wanted]
        items = svc.filter_recipes(
            pantry_ids=pantry_ids,
            meal_types=meal_types or [],
            cuisine_regions=cuisine_regions or [],
        )
    except RecipesError as exc:
        return _error(exc)
    return {"recipes": [r.to_dict() for r in items]}


# --- writes -------------------------------------------------------------------


def create_recipe(*, recipe: dict | None = None, service=None) -> dict[str, Any]:
    svc = service or _recipes
    try:
        dto = NewRecipeDTO.from_dict(recipe or {})
        created = svc.create_recipe(dto)
    except RecipesError as exc:
        return _error(exc)
    return {"recipe": created.to_dict()}


def update_recipe(*, recipe_id: int, recipe: dict | None = None, service=None) -> dict[str, Any]:
    svc = service or _recipes
    try:
        dto = NewRecipeDTO.from_dict(recipe or {})
        updated = svc.update_recipe(recipe_id, dto)
    except RecipesError as exc:
        return _error(exc)
    return {"recipe": updated.to_dict()}


def delete_recipe(*, recipe_id: int, confirm: bool = False, service=None) -> dict[str, Any]:
    if confirm is not True:
        return _denied("Deleting a recipe requires confirm: true")
    svc = service or _recipes
    try:
        svc.delete_recipe(recipe_id)
    except RecipesError as exc:
        return _error(exc)
    return {"deleted": True, "recipe_id": recipe_id}
