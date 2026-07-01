from __future__ import annotations

import importlib
from pathlib import Path
from unittest.mock import MagicMock

import yaml
from django.conf import settings

from utils.apps.recipes.agent import tools
from utils.apps.recipes.shared.errors import NotFoundError
from utils.apps.recipes.shared.schemas import RecipeSummaryDTO


# --- structured output + service injection ------------------------------------


def test_list_recipes_returns_structured_output():
    mock = MagicMock()
    mock.list_all.return_value = [
        RecipeSummaryDTO(
            id=1,
            title="Test",
            description=None,
            servings=2,
            cuisine_region=None,
            meal_type=None,
            image_url=None,
        )
    ]
    payload = tools.list_recipes(service=mock)
    assert payload["recipes"][0]["id"] == 1
    mock.list_all.assert_called_once_with()


def test_get_recipe_not_found_surfaces_error():
    mock = MagicMock()
    mock.get_by_id.side_effect = NotFoundError("Recipe 9 not found", details={"id": 9})
    payload = tools.get_recipe(recipe_id=9, service=mock)
    assert payload["error"]["code"] == "not_found"


def test_create_recipe_validation_error_skips_service():
    mock = MagicMock()
    payload = tools.create_recipe(recipe={"title": ""}, service=mock)
    assert payload["error"]["code"] == "validation_error"
    mock.create_recipe.assert_not_called()


# --- confirm gate on delete ---------------------------------------------------


def test_delete_recipe_without_confirm_is_denied():
    mock = MagicMock()
    payload = tools.delete_recipe(recipe_id=1, confirm=False, service=mock)
    assert payload["error"]["code"] == "permission_denied"
    mock.delete_recipe.assert_not_called()


def test_delete_recipe_with_confirm_calls_service():
    mock = MagicMock()
    payload = tools.delete_recipe(recipe_id=1, confirm=True, service=mock)
    assert payload == {"deleted": True, "recipe_id": 1}
    mock.delete_recipe.assert_called_once_with(1)


# --- integration against the seeded DB ----------------------------------------


def test_find_by_ingredients_resolves_names():
    payload = tools.find_by_ingredients(
        ingredient_names=["lettuce", "tomato", "carrot", "avocado", "olive oil", "lemon", "salt"]
    )
    assert payload["recipes"][0]["title"] == "Fresh Garden Salad"
    assert payload["recipes"][0]["match_percentage"] == 100.0


def test_list_ingredients_integration():
    payload = tools.list_ingredients()
    names = {i["name"] for i in payload["ingredients"]}
    assert "garlic" in names


# --- registry consistency -----------------------------------------------------


def test_tools_yaml_entries_resolve():
    config = yaml.safe_load(
        (Path(settings.BASE_DIR) / "config" / "tools.yaml").read_text()
    )
    recipes_tools = {
        name: meta
        for name, meta in config["tools"].items()
        if meta.get("app") == "recipes"
    }
    assert len(recipes_tools) == 7
    for meta in recipes_tools.values():
        module = importlib.import_module(meta["module"])
        assert callable(getattr(module, meta["function"]))
