"""Route module for the recipes app, mounted at ``/api/recipes/`` in
config/django/urls.py. Views call backend/services/ only."""

from django.urls import path

from utils.apps.recipes.backend.api.views import (
    FilterOptionsView,
    ImageServeView,
    ImageUploadView,
    IngredientSearchView,
    IngredientsView,
    ParseRecipeView,
    RecipeDetailView,
    RecipeFilterView,
    RecipeListCreateView,
)

urlpatterns = [
    # Recipes (specific subpaths before the <int:recipe_id> detail route)
    path("recipes/filter/", RecipeFilterView.as_view(), name="recipes-filter"),
    path("recipes/", RecipeListCreateView.as_view(), name="recipes-list"),
    path("recipes/<int:recipe_id>/", RecipeDetailView.as_view(), name="recipes-detail"),
    # Ingredients + filter options
    path("ingredients/search/", IngredientSearchView.as_view(), name="recipes-ingredient-search"),
    path("ingredients/", IngredientsView.as_view(), name="recipes-ingredients"),
    path("filter-options/", FilterOptionsView.as_view(), name="recipes-filter-options"),
    # AI Chef parser (API-only)
    path("parse/", ParseRecipeView.as_view(), name="recipes-parse"),
    # Images (API-only): upload, then serve by name
    path("images/", ImageUploadView.as_view(), name="recipes-image-upload"),
    path("images/<str:filename>", ImageServeView.as_view(), name="recipes-image-serve"),
]
