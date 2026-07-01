from __future__ import annotations

# Django database alias for the recipes SQLite file. The connection is registered
# in config/django/settings.py and routed by
# utils.apps.recipes.backend.db_router.RecipesRouter.
DB_ALIAS = "recipes"

# Default page size for list endpoints (platform default).
DEFAULT_PAGE_SIZE = 25

# Default servings when a recipe omits the field (matches the legacy Flask app).
DEFAULT_SERVINGS = 4

# Ingredient category display order, preserved from the legacy pantry grouping.
CATEGORY_ORDER = (
    "Produce",
    "Dairy & Eggs",
    "Pantry / Dry Goods",
    "Canned / Jarred",
    "Proteins",
    "Spices & Baking",
    "Other",
)
DEFAULT_CATEGORY = "Other"

# UI suggestion lists (the DB stores free text; these only seed the form chips).
CUISINE_OPTIONS = (
    "Italian",
    "Mexican",
    "Japanese",
    "Chinese",
    "Indian",
    "Thai",
    "American",
    "French",
    "Mediterranean",
    "Asian",
)
MEAL_TYPE_OPTIONS = (
    "Breakfast",
    "Lunch",
    "Dinner",
    "Snack",
    "Side Dish",
    "Dessert",
)

# Image upload constraints (preserved from the legacy /api/upload-image route).
ALLOWED_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".gif")
