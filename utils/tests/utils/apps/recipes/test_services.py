from __future__ import annotations

import pytest

from utils.apps.recipes.backend.services import images, ingredients, parser
from utils.apps.recipes.backend.services import recipes as recipes_service
from utils.apps.recipes.shared.errors import (
    NotFoundError,
    PermissionDeniedError,
    RecipesError,
    ValidationError,
)
from utils.apps.recipes.shared.schemas import NewRecipeDTO


# --- seed / listing -----------------------------------------------------------


def test_seed_populates_sample_recipes():
    summaries = recipes_service.list_all()
    titles = {s.title for s in summaries}
    assert len(summaries) == 5
    assert "Classic Spaghetti Carbonara" in titles


def test_ingredients_by_category_uses_display_order():
    grouped = ingredients.by_category()
    keys = list(grouped.keys())
    assert keys[0] == "Produce"  # first in CATEGORY_ORDER
    assert any(item["name"] == "garlic" for item in grouped["Produce"])


def test_ingredient_search_ranks_prefix_first():
    results = ingredients.search("gar")
    assert results[0].name == "garlic"


# --- detail -------------------------------------------------------------------


def test_get_by_id_returns_structured_detail():
    carbonara = next(r for r in recipes_service.list_all() if r.title.startswith("Classic"))
    detail = recipes_service.get_by_id(carbonara.id)
    assert detail.servings == 4
    assert len(detail.steps) == 7
    names = {i.name for i in detail.ingredients}
    assert "pasta" in names
    optional = {i.name for i in detail.ingredients if i.is_optional}
    assert "garlic" in optional


def test_get_by_id_missing_raises_not_found():
    with pytest.raises(NotFoundError) as exc:
        recipes_service.get_by_id(999999)
    assert exc.value.code == "not_found"


# --- pantry match -------------------------------------------------------------


def _ingredient_id(name: str) -> int:
    return next(i.id for i in ingredients.list_all() if i.name == name)


def test_filter_by_pantry_ranks_by_match_percentage():
    # Salad needs lettuce/tomato/carrot/avocado/olive oil/lemon/salt.
    pantry = [
        _ingredient_id(n)
        for n in ("lettuce", "tomato", "carrot", "avocado", "olive oil", "lemon", "salt")
    ]
    results = recipes_service.filter_recipes(pantry_ids=pantry)
    assert results[0].title == "Fresh Garden Salad"
    assert results[0].match_percentage == 100.0
    assert results[0].matched_ingredients == results[0].total_ingredients


def test_filter_by_meal_type_only():
    results = recipes_service.filter_recipes(meal_types=["Lunch"])
    titles = {r.title for r in results}
    assert titles == {"Fresh Garden Salad", "Creamy Tomato Basil Soup"}
    assert all(r.match_percentage is None for r in results)


def test_filter_no_arguments_returns_all():
    assert len(recipes_service.filter_recipes()) == 5


def test_distinct_filter_options():
    meals = {row["value"] for row in recipes_service.distinct_meal_types()}
    cuisines = {row["value"] for row in recipes_service.distinct_cuisine_regions()}
    assert {"Dinner", "Lunch"} <= meals
    assert "Italian" in cuisines


# --- create / update / delete -------------------------------------------------


def _new_recipe(**overrides) -> dict:
    payload = {
        "title": "Test Omelette",
        "description": "Quick eggs",
        "servings": 1,
        "cuisine_region": "French",
        "meal_type": "Breakfast",
        "ingredients": [
            {"name": "Eggs", "quantity": 3, "unit": "large", "category": "Dairy & Eggs"},
            {"name": "Butter", "quantity": 1, "unit": "tbsp", "is_optional": True},
        ],
        "steps": ["Beat the eggs.", "Cook in butter."],
    }
    payload.update(overrides)
    return payload


def test_create_recipe_persists_children():
    detail = recipes_service.create_recipe(NewRecipeDTO.from_dict(_new_recipe()))
    assert detail.id > 0
    fetched = recipes_service.get_by_id(detail.id)
    assert fetched.title == "Test Omelette"
    assert len(fetched.ingredients) == 2
    assert len(fetched.steps) == 2
    # ingredient names are normalized to lowercase, reusing existing rows
    assert {"eggs", "butter"} == {i.name for i in fetched.ingredients}


@pytest.mark.parametrize(
    "bad",
    [
        {"title": ""},  # missing title
        {"ingredients": []},  # empty ingredients
        {"steps": []},  # empty steps
    ],
)
def test_new_recipe_validation_denials(bad):
    with pytest.raises(ValidationError):
        NewRecipeDTO.from_dict(_new_recipe(**bad))


def test_update_recipe_replaces_children():
    created = recipes_service.create_recipe(NewRecipeDTO.from_dict(_new_recipe()))
    updated = recipes_service.update_recipe(
        created.id,
        NewRecipeDTO.from_dict(
            _new_recipe(title="Renamed", steps=["Only one step."], ingredients=[{"name": "Salt"}])
        ),
    )
    assert updated.title == "Renamed"
    assert len(updated.steps) == 1
    assert len(updated.ingredients) == 1


def test_update_missing_recipe_raises_not_found():
    with pytest.raises(NotFoundError):
        recipes_service.update_recipe(999999, NewRecipeDTO.from_dict(_new_recipe()))


def test_delete_recipe_removes_it():
    created = recipes_service.create_recipe(NewRecipeDTO.from_dict(_new_recipe()))
    recipes_service.delete_recipe(created.id)
    with pytest.raises(NotFoundError):
        recipes_service.get_by_id(created.id)


def test_delete_missing_recipe_raises_not_found():
    with pytest.raises(NotFoundError):
        recipes_service.delete_recipe(999999)


# --- images -------------------------------------------------------------------


def test_save_uploaded_image_rejects_bad_extension():
    with pytest.raises(ValidationError):
        images.save_uploaded_image("evil.exe", b"data")


def test_save_and_resolve_image_roundtrip():
    url = images.save_uploaded_image("pic.png", b"bytes")
    name = url.rsplit("/", 1)[-1]
    assert images.resolve_image_path(name).endswith(name)


@pytest.mark.parametrize("bad", ["../secrets.json", "sub/dir.png", ".."])
def test_resolve_image_path_blocks_traversal(bad):
    with pytest.raises(PermissionDeniedError):
        images.resolve_image_path(bad)


# --- parser (LLM-backed, injected client) -------------------------------------


class _FakeClient:
    def __init__(self, reply: str):
        self._reply = reply

    def chat(self, messages):
        return self._reply


def test_parse_recipe_text_returns_structured_dict():
    reply = '```json\n{"title": "Toast", "ingredients": [], "steps": []}\n```'
    parsed = parser.parse_recipe_text("bread, heat", client=_FakeClient(reply))
    assert parsed["title"] == "Toast"


def test_parse_recipe_text_empty_input_denied():
    with pytest.raises(ValidationError):
        parser.parse_recipe_text("   ", client=_FakeClient("{}"))


def test_parse_recipe_text_bad_json_raises():
    with pytest.raises(RecipesError):
        parser.parse_recipe_text("stuff", client=_FakeClient("not json"))
