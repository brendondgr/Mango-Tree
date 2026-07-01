"""Recipe domain logic: listing, pantry match, detail, and CRUD. Single source of
truth for both the DRF API and the agent tools. All persistence goes through the
routed ``recipes`` connection via the ORM."""

from __future__ import annotations

from django.db import transaction
from django.db.models import Q

from utils.apps.recipes.backend.models import (
    Ingredient,
    Recipe,
    RecipeImage,
    RecipeIngredient,
    Step,
)
from utils.apps.recipes.backend.services import store
from utils.apps.recipes.shared.constants import DB_ALIAS
from utils.apps.recipes.shared.errors import NotFoundError
from utils.apps.recipes.shared.schemas import (
    NewRecipeDTO,
    RecipeDetailDTO,
    RecipeIngredientDTO,
    RecipeSummaryDTO,
    StepDTO,
)

# --- read helpers -------------------------------------------------------------


def _images_for(recipe: Recipe, image_rows=None) -> list[str]:
    rows = image_rows if image_rows is not None else list(recipe.images.order_by("display_order"))
    urls = [row.image_url for row in rows if row.image_url]
    if not urls and recipe.image_url:
        urls = [recipe.image_url]
    return urls


def _summary(
    recipe: Recipe,
    *,
    total: int = 0,
    matched: int = 0,
    match_percentage: float | None = None,
    image_rows=None,
) -> RecipeSummaryDTO:
    return RecipeSummaryDTO(
        id=recipe.id,
        title=recipe.title,
        description=recipe.description,
        servings=recipe.servings,
        cuisine_region=recipe.cuisine_region,
        meal_type=recipe.meal_type,
        image_url=recipe.image_url,
        images=_images_for(recipe, image_rows),
        total_ingredients=total,
        matched_ingredients=matched,
        match_percentage=match_percentage,
    )


def _get_row(recipe_id: int) -> Recipe:
    recipe = Recipe.objects.filter(id=recipe_id).first()
    if recipe is None:
        raise NotFoundError(f"Recipe {recipe_id} not found", details={"id": recipe_id})
    return recipe


# --- reads --------------------------------------------------------------------


def list_all() -> list[RecipeSummaryDTO]:
    store.ensure_initialized()
    recipes = Recipe.objects.prefetch_related("images").order_by("title")
    return [_summary(r) for r in recipes]


def get_by_id(recipe_id: int) -> RecipeDetailDTO:
    store.ensure_initialized()
    recipe = _get_row(recipe_id)

    images = _images_for(recipe)

    ingredients = [
        RecipeIngredientDTO(
            id=ri.ingredient_id,
            name=ri.ingredient.name,
            quantity=ri.quantity,
            unit=ri.unit,
            is_optional=bool(ri.is_optional),
        )
        for ri in recipe.recipe_ingredients.select_related("ingredient").order_by("id")
    ]
    steps = [
        StepDTO(step_number=s.step_number, instruction=s.instruction)
        for s in recipe.steps.order_by("step_number")
    ]

    return RecipeDetailDTO(
        id=recipe.id,
        title=recipe.title,
        description=recipe.description,
        servings=recipe.servings,
        cuisine_region=recipe.cuisine_region,
        meal_type=recipe.meal_type,
        image_url=recipe.image_url,
        images=images,
        ingredients=ingredients,
        steps=steps,
    )


def filter_recipes(
    pantry_ids: list[int] | None = None,
    meal_types: list[str] | None = None,
    cuisine_regions: list[str] | None = None,
) -> list[RecipeSummaryDTO]:
    """Filter recipes by primary filters and rank by pantry-ingredient match %.

    - No filters at all → all recipes (no match badge).
    - Meal types / cuisine regions match inclusively (OR) within a category and
      combine across categories with AND.
    - match % = non-optional ingredients present in the pantry / total
      non-optional ingredients, ordered desc then by title.
    """
    store.ensure_initialized()
    pantry = {int(i) for i in (pantry_ids or [])}
    meal_types = [m for m in (meal_types or []) if m]
    cuisine_regions = [c for c in (cuisine_regions or []) if c]

    if not pantry and not meal_types and not cuisine_regions:
        return list_all()

    qs = Recipe.objects.prefetch_related("recipe_ingredients", "images")

    if meal_types:
        clause = Q()
        for value in meal_types:
            clause |= Q(meal_type__icontains=value)
        qs = qs.filter(clause)
    if cuisine_regions:
        clause = Q()
        for value in cuisine_regions:
            clause |= Q(cuisine_region__icontains=value)
        qs = qs.filter(clause)

    results: list[RecipeSummaryDTO] = []
    for recipe in qs:
        required = [ri for ri in recipe.recipe_ingredients.all() if not ri.is_optional]
        total = len(required)
        matched = sum(1 for ri in required if ri.ingredient_id in pantry)
        percentage = round((matched / total) * 100, 1) if (pantry and total > 0) else None
        results.append(
            _summary(
                recipe,
                total=total,
                matched=matched,
                match_percentage=percentage,
                image_rows=list(recipe.images.all()),
            )
        )

    # Highest match first (recipes without a percentage sort last), then title.
    results.sort(
        key=lambda d: (
            0 if d.match_percentage is not None else 1,
            -(d.match_percentage or 0.0),
            d.title,
        )
    )
    return results


def distinct_meal_types() -> list[dict]:
    return _distinct_values("meal_type")


def distinct_cuisine_regions() -> list[dict]:
    return _distinct_values("cuisine_region")


def _distinct_values(field_name: str) -> list[dict]:
    store.ensure_initialized()
    counts: dict[str, int] = {}
    rows = Recipe.objects.exclude(**{f"{field_name}__isnull": True}).exclude(
        **{field_name: ""}
    )
    for recipe in rows:
        raw = getattr(recipe, field_name) or ""
        for value in (part.strip() for part in raw.split(",")):
            if value:
                counts[value] = counts.get(value, 0) + 1
    return [{"value": key, "count": counts[key]} for key in sorted(counts)]


# --- writes -------------------------------------------------------------------


def _get_or_create_ingredient(name: str, category: str) -> Ingredient:
    key = name.lower().strip()
    ingredient = Ingredient.objects.filter(name=key).first()
    if ingredient is not None:
        return ingredient
    return Ingredient.objects.create(name=key, category=category or "Other")


def _write_children(recipe: Recipe, dto: NewRecipeDTO) -> None:
    processed = [url for url in dto.image_urls if url]
    for index, url in enumerate(processed):
        RecipeImage.objects.create(recipe=recipe, image_url=url, display_order=index)
    for ing in dto.ingredients:
        ingredient = _get_or_create_ingredient(ing.name, ing.category)
        RecipeIngredient.objects.create(
            recipe=recipe,
            ingredient=ingredient,
            quantity=ing.quantity,
            unit=ing.unit or "",
            is_optional=1 if ing.is_optional else 0,
        )
    for index, instruction in enumerate(dto.steps, start=1):
        Step.objects.create(recipe=recipe, step_number=index, instruction=instruction)


def create_recipe(dto: NewRecipeDTO) -> RecipeDetailDTO:
    store.ensure_initialized()
    main_image = next((url for url in dto.image_urls if url), "")
    with transaction.atomic(using=DB_ALIAS):
        recipe = Recipe.objects.create(
            title=dto.title,
            description=dto.description or "",
            image_url=main_image,
            servings=dto.servings,
            cuisine_region=dto.cuisine_region or "",
            meal_type=dto.meal_type or "",
        )
        _write_children(recipe, dto)
    return get_by_id(recipe.id)


def update_recipe(recipe_id: int, dto: NewRecipeDTO) -> RecipeDetailDTO:
    """Update a recipe, replacing its images/ingredients/steps wholesale (mirrors
    the legacy delete-then-reinsert update)."""
    store.ensure_initialized()
    recipe = _get_row(recipe_id)
    main_image = next((url for url in dto.image_urls if url), "")
    with transaction.atomic(using=DB_ALIAS):
        recipe.title = dto.title
        recipe.description = dto.description or ""
        recipe.image_url = main_image
        recipe.servings = dto.servings
        recipe.cuisine_region = dto.cuisine_region or ""
        recipe.meal_type = dto.meal_type or ""
        recipe.save(
            update_fields=[
                "title",
                "description",
                "image_url",
                "servings",
                "cuisine_region",
                "meal_type",
            ]
        )
        RecipeImage.objects.filter(recipe=recipe).delete()
        RecipeIngredient.objects.filter(recipe=recipe).delete()
        Step.objects.filter(recipe=recipe).delete()
        _write_children(recipe, dto)
    return get_by_id(recipe.id)


def delete_recipe(recipe_id: int) -> None:
    store.ensure_initialized()
    recipe = _get_row(recipe_id)
    with transaction.atomic(using=DB_ALIAS):
        Step.objects.filter(recipe=recipe).delete()
        RecipeIngredient.objects.filter(recipe=recipe).delete()
        RecipeImage.objects.filter(recipe=recipe).delete()
        recipe.delete()
