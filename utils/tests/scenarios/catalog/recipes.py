"""Recipes tools (7): browse, pantry match, CRUD."""

from __future__ import annotations

from utils.tests.scenarios import harness as h
from utils.tests.scenarios.catalog._common import approved

G = ["core", "recipes"]

_PASTA = {
    "title": "Scenario Garlic Butter Pasta",
    "description": "Weeknight pasta.",
    "servings": 2,
    "cuisine_region": "Italian",
    "meal_type": "dinner",
    "ingredients": [
        {"name": "spaghetti", "quantity": 200, "unit": "g", "category": "grains"},
        {"name": "butter", "quantity": 3, "unit": "tbsp", "category": "dairy"},
        {"name": "garlic", "quantity": 3, "unit": "cloves", "category": "vegetables"},
        {"name": "parmesan", "quantity": 30, "unit": "g", "category": "dairy", "is_optional": True},
    ],
    "steps": ["Boil the pasta.", "Melt butter, fry garlic.", "Toss and serve with parmesan."],
}


def _titles(sb):
    from utils.apps.recipes.backend.services import recipes
    return [r.title for r in recipes.list_all()]


SCENARIOS = [
    h.Scenario(
        id="recipes.browse_then_detail",
        title="List recipes, then open one",
        groups=G,
        prompt="What recipes do I have? Show me the full details of the first one.",
        notes="The detail call must use an id returned by the list call, not an invented one.",
        turns=[
            h.calls(h.call("recipes_list_recipes", "summary cards carry the ids")),
            h.calls(h.dynamic("recipes_get_recipe", "open the first card by its id",
                              lambda ctx: {"recipe_id": ctx.result("recipes_list_recipes")["recipes"][0]["id"]},
                              check=lambda r: _assert("ingredients" in r["recipe"] and "steps" in r["recipe"]))),
            h.answer("Here are your recipes; the first one has its ingredients and steps above."),
        ],
        live=h.LiveExpectation(required=["recipes_list_recipes", "recipes_get_recipe"],
                               order=[("recipes_list_recipes", "recipes_get_recipe")],
                               forbidden=["recipes_delete_recipe", "recipes_create_recipe"]),
    ),
    h.Scenario(
        id="recipes.pantry_match",
        title="What can I cook with what I have",
        groups=G,
        prompt="I have eggs, onions and rice at home. What can I make?",
        turns=[
            h.calls(h.call("recipes_find_by_ingredients", "'what can I make with X' maps to the pantry matcher",
                           ingredient_names=["eggs", "onion", "rice"],
                           check=lambda r: _assert(isinstance(r["recipes"], list)))),
            h.answer("Best matches for eggs, onion and rice are listed above, ranked by match."),
        ],
        live=h.LiveExpectation(required=["recipes_find_by_ingredients"],
                               forbidden=["recipes_create_recipe", "recipes_delete_recipe"]),
    ),
    h.Scenario(
        id="recipes.pantry_catalog",
        title="Read the ingredient catalog",
        groups=G,
        prompt="Which ingredients are in my pantry catalog, and how many are vegetables?",
        turns=[
            h.calls(h.call("recipes_list_ingredients", "the catalog is the only source for categories")),
            h.answer("Your catalog and its vegetable count are above."),
        ],
        live=h.LiveExpectation(required=["recipes_list_ingredients"]),
    ),
    h.Scenario(
        id="recipes.create_then_update",
        title="Create a recipe, then change its servings",
        groups=G,
        prompt=("Save a recipe: Scenario Garlic Butter Pasta for 2 (spaghetti 200 g, butter 3 tbsp, "
                "garlic 3 cloves, optional parmesan); boil pasta, fry garlic in butter, toss. "
                "Then change it to serve 6."),
        notes="update_recipe replaces wholesale, so the update carries the full object with the new servings.",
        turns=[
            h.calls(h.call("recipes_create_recipe", "structured create with ingredients + steps", recipe=_PASTA,
                           check=lambda r: _assert(r["recipe"]["servings"] == 2))),
            h.calls(h.dynamic("recipes_update_recipe", "wholesale replace using the returned id",
                              lambda ctx: {"recipe_id": ctx.result("recipes_create_recipe")["recipe"]["id"],
                                           "recipe": {**_PASTA, "servings": 6}},
                              check=lambda r: _assert(r["recipe"]["servings"] == 6))),
            h.answer("Saved Scenario Garlic Butter Pasta and set it to serve 6."),
        ],
        live=h.LiveExpectation(required=["recipes_create_recipe", "recipes_update_recipe"],
                               order=[("recipes_create_recipe", "recipes_update_recipe")],
                               forbidden=["recipes_delete_recipe"]),
        verify=lambda sb: _assert("Scenario Garlic Butter Pasta" in _titles(sb)),
    ),
    h.Scenario(
        id="recipes.delete_requires_confirm",
        title="Delete without approval is refused",
        groups=G,
        prompt="Delete the first recipe in my book.",
        turns=[
            h.calls(h.call("recipes_list_recipes", "find the id")),
            h.calls(h.dynamic("recipes_delete_recipe", "not yet approved -> no confirm",
                              lambda ctx: {"recipe_id": ctx.result("recipes_list_recipes")["recipes"][0]["id"]},
                              expect=h.DENIED_CONFIRM)),
            h.answer("Deleting is permanent. Do you want me to go ahead?"),
        ],
        live=h.LiveExpectation(answer_any=["confirm", "sure", "permanent", "go ahead", "delete"]),
        verify=lambda sb: _assert(len(_titles(sb)) == sb.seed("recipes", "recipe_count"), "a recipe was deleted"),
    ),
    h.Scenario(
        id="recipes.delete_after_approval",
        title="Delete after approval",
        groups=G,
        history=approved("Delete the first recipe in my book.", "That is permanent. Delete it?"),
        prompt="Yes, delete it.",
        turns=[
            h.calls(h.call("recipes_list_recipes", "find the id")),
            h.calls(h.dynamic("recipes_delete_recipe", "approved -> confirm: true",
                              lambda ctx: {"recipe_id": ctx.result("recipes_list_recipes")["recipes"][0]["id"],
                                           "confirm": True},
                              check=lambda r: _assert(r["deleted"] is True))),
            h.answer("Deleted it."),
        ],
        live=h.LiveExpectation(required=["recipes_delete_recipe"]),
        verify=lambda sb: _assert(len(_titles(sb)) == sb.seed("recipes", "recipe_count") - 1, "nothing was deleted"),
    ),
    h.Scenario(
        id="recipes.typed_errors",
        title="not_found and validation_error are typed, not crashes",
        groups=G,
        prompt="Open recipe 999999, and save a recipe called Air with no steps.",
        turns=[
            h.calls(
                h.call("recipes_get_recipe", "an id that does not exist", recipe_id=999999, expect=h.error("not_found")),
                h.call("recipes_create_recipe", "missing steps must be rejected",
                       recipe={"title": "Air", "ingredients": [{"name": "air"}], "steps": []},
                       expect=h.error("validation_error")),
            ),
            h.answer("Recipe 999999 does not exist, and a recipe needs at least one step."),
        ],
    ),
]


def _assert(condition, message: str = "check failed") -> None:
    assert condition, message
