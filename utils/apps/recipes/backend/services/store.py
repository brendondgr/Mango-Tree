"""Recipes SQLite store: schema ownership + seed-on-first-run.

The recipes models are ``managed = False``, so Django never creates their tables.
This module is the single owner of the schema DDL (ported verbatim from the
legacy Flask app) and of the small sample dataset. ``ensure_initialized()`` is
called at the top of every service entry point; it is idempotent and cheap
(guarded per resolved DB path so a test that repoints the ``recipes`` connection
to a throwaway file re-seeds that file exactly once).
"""

from __future__ import annotations

import os

from django.db import connections

from utils.apps.recipes.shared.constants import DB_ALIAS

# --- schema (owns the tables the managed=False models bind to) ----------------

SCHEMA_STATEMENTS = (
    """
    CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        servings INTEGER DEFAULT 4,
        cuisine_region TEXT,
        meal_type TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL DEFAULT 'Other'
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        ingredient_id INTEGER NOT NULL,
        quantity REAL,
        unit TEXT,
        is_optional INTEGER DEFAULT 0,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
        FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS steps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        step_number INTEGER NOT NULL,
        instruction TEXT NOT NULL,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS recipe_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL,
        image_url TEXT,
        display_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id)",
    "CREATE INDEX IF NOT EXISTS idx_steps_recipe ON steps(recipe_id)",
    "CREATE INDEX IF NOT EXISTS idx_recipe_images_recipe ON recipe_images(recipe_id)",
)

# --- sample data (seeded only into an empty database) -------------------------

_SAMPLE_INGREDIENTS = [
    ("Tomato", "Produce"),
    ("Onion", "Produce"),
    ("Garlic", "Produce"),
    ("Bell Pepper", "Produce"),
    ("Lettuce", "Produce"),
    ("Carrot", "Produce"),
    ("Lemon", "Produce"),
    ("Basil", "Produce"),
    ("Spinach", "Produce"),
    ("Avocado", "Produce"),
    ("Butter", "Dairy & Eggs"),
    ("Milk", "Dairy & Eggs"),
    ("Cheddar Cheese", "Dairy & Eggs"),
    ("Parmesan Cheese", "Dairy & Eggs"),
    ("Heavy Cream", "Dairy & Eggs"),
    ("Eggs", "Dairy & Eggs"),
    ("Chicken Breast", "Proteins"),
    ("Ground Beef", "Proteins"),
    ("Salmon", "Proteins"),
    ("Shrimp", "Proteins"),
    ("Bacon", "Proteins"),
    ("Olive Oil", "Pantry / Dry Goods"),
    ("Pasta", "Pantry / Dry Goods"),
    ("Rice", "Pantry / Dry Goods"),
    ("Flour", "Pantry / Dry Goods"),
    ("Sugar", "Pantry / Dry Goods"),
    ("Chicken Broth", "Canned / Jarred"),
    ("Soy Sauce", "Canned / Jarred"),
    ("Salt", "Spices & Baking"),
    ("Black Pepper", "Spices & Baking"),
]

_SAMPLE_RECIPES = [
    {
        "title": "Classic Spaghetti Carbonara",
        "description": "A creamy Italian pasta dish with bacon and parmesan",
        "image_url": "https://placehold.co/400x250/FF6B6B/FFF?text=Carbonara",
        "servings": 4,
        "cuisine_region": "Italian",
        "meal_type": "Dinner",
        "ingredients": [
            ("Pasta", 400, "g", False),
            ("Bacon", 200, "g", False),
            ("Eggs", 4, "large", False),
            ("Parmesan Cheese", 100, "g", False),
            ("Black Pepper", 1, "tsp", False),
            ("Garlic", 2, "cloves", True),
        ],
        "steps": [
            "Boil pasta in salted water according to package directions.",
            "Cook bacon in a large skillet until crispy, then set aside.",
            "Whisk eggs and parmesan in a bowl.",
            "Drain pasta, reserving 1 cup of pasta water.",
            "Toss hot pasta with bacon, then remove from heat.",
            "Add egg mixture, tossing quickly to create creamy sauce.",
            "Add pasta water if needed. Season with pepper and serve.",
        ],
    },
    {
        "title": "Garlic Butter Salmon",
        "description": "Pan-seared salmon with a rich garlic butter sauce",
        "image_url": "https://placehold.co/400x250/4ECDC4/FFF?text=Salmon",
        "servings": 2,
        "cuisine_region": "American",
        "meal_type": "Dinner",
        "ingredients": [
            ("Salmon", 2, "fillets", False),
            ("Butter", 3, "tbsp", False),
            ("Garlic", 4, "cloves", False),
            ("Lemon", 1, "whole", False),
            ("Salt", 1, "tsp", False),
            ("Black Pepper", 0.5, "tsp", False),
        ],
        "steps": [
            "Season salmon with salt and pepper.",
            "Heat butter in a skillet over medium-high heat.",
            "Sear salmon skin-side up for 4 minutes.",
            "Flip and cook 3 more minutes.",
            "Add minced garlic, cook 30 seconds.",
            "Squeeze lemon over salmon and serve.",
        ],
    },
    {
        "title": "Fresh Garden Salad",
        "description": "A light and refreshing salad with seasonal vegetables",
        "image_url": "https://placehold.co/400x250/95E1D3/333?text=Salad",
        "servings": 2,
        "cuisine_region": "Mediterranean",
        "meal_type": "Lunch",
        "ingredients": [
            ("Lettuce", 1, "head", False),
            ("Tomato", 2, "medium", False),
            ("Carrot", 1, "large", False),
            ("Avocado", 1, "whole", False),
            ("Olive Oil", 3, "tbsp", False),
            ("Lemon", 1, "whole", False),
            ("Salt", 0.5, "tsp", False),
        ],
        "steps": [
            "Wash and chop lettuce into bite-sized pieces.",
            "Dice tomatoes and slice carrots thinly.",
            "Slice avocado.",
            "Combine all vegetables in a large bowl.",
            "Whisk olive oil with lemon juice and salt.",
            "Drizzle dressing over salad and toss gently.",
        ],
    },
    {
        "title": "Creamy Tomato Basil Soup",
        "description": "A comforting soup with fresh tomatoes and aromatic basil",
        "image_url": "https://placehold.co/400x250/E74C3C/FFF?text=Soup",
        "servings": 6,
        "cuisine_region": "Italian",
        "meal_type": "Lunch",
        "ingredients": [
            ("Tomato", 6, "large", False),
            ("Onion", 1, "medium", False),
            ("Garlic", 3, "cloves", False),
            ("Basil", 1, "cup", False),
            ("Heavy Cream", 0.5, "cup", False),
            ("Chicken Broth", 2, "cups", False),
            ("Olive Oil", 2, "tbsp", False),
            ("Salt", 1, "tsp", False),
        ],
        "steps": [
            "Dice tomatoes and onion, mince garlic.",
            "Heat olive oil in a pot over medium heat.",
            "Sauté onion until soft, about 5 minutes.",
            "Add garlic and cook 1 minute.",
            "Add tomatoes and broth, simmer 20 minutes.",
            "Blend soup until smooth.",
            "Stir in cream and chopped basil.",
            "Season with salt and serve warm.",
        ],
    },
    {
        "title": "Stir-Fry Vegetables with Rice",
        "description": "Quick and healthy Asian-inspired stir-fry",
        "image_url": "https://placehold.co/400x250/9B59B6/FFF?text=Stir-Fry",
        "servings": 4,
        "cuisine_region": "Asian",
        "meal_type": "Dinner",
        "ingredients": [
            ("Rice", 2, "cups", False),
            ("Bell Pepper", 2, "medium", False),
            ("Carrot", 2, "large", False),
            ("Onion", 1, "medium", False),
            ("Garlic", 3, "cloves", False),
            ("Soy Sauce", 3, "tbsp", False),
            ("Olive Oil", 2, "tbsp", False),
        ],
        "steps": [
            "Cook rice according to package directions.",
            "Slice bell peppers, carrots, and onion.",
            "Heat oil in a wok over high heat.",
            "Stir-fry vegetables 5-7 minutes until tender-crisp.",
            "Add minced garlic and soy sauce.",
            "Toss well and serve over rice.",
        ],
    },
]

# Guard so the DDL + empty-check runs once per resolved DB path per process.
_initialized_paths: set[str] = set()


def _db_path() -> str:
    return connections[DB_ALIAS].settings_dict["NAME"]


def ensure_initialized() -> None:
    """Create the schema if missing and seed sample data into an empty DB.

    Idempotent and safe to call on every request. The sample data is only
    inserted when the ``recipes`` table has zero rows, so it never clobbers real
    content."""
    path = _db_path()
    if path in _initialized_paths:
        return

    directory = os.path.dirname(path)
    if directory:
        os.makedirs(directory, exist_ok=True)

    connection = connections[DB_ALIAS]
    with connection.cursor() as cursor:
        for statement in SCHEMA_STATEMENTS:
            cursor.execute(statement)
        cursor.execute("SELECT COUNT(*) FROM recipes")
        (count,) = cursor.fetchone()
        if count == 0:
            _seed(cursor)

    _initialized_paths.add(path)


def _seed(cursor) -> None:
    # NOTE: Django's SQLite cursor wrapper uses the ``%s`` paramstyle (it rewrites
    # ``%s`` -> ``?`` internally). Using literal ``?`` here breaks DEBUG query
    # logging, so all placeholders below are ``%s``.
    for name, category in _SAMPLE_INGREDIENTS:
        cursor.execute(
            "INSERT OR IGNORE INTO ingredients (name, category) VALUES (%s, %s)",
            (name.lower().strip(), category),
        )

    for recipe in _SAMPLE_RECIPES:
        cursor.execute(
            """INSERT INTO recipes (title, description, image_url, servings, cuisine_region, meal_type)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (
                recipe["title"],
                recipe["description"],
                recipe["image_url"],
                recipe["servings"],
                recipe["cuisine_region"],
                recipe["meal_type"],
            ),
        )
        recipe_id = cursor.lastrowid

        cursor.execute(
            "INSERT INTO recipe_images (recipe_id, image_url, display_order) VALUES (%s, %s, 0)",
            (recipe_id, recipe["image_url"]),
        )

        for ing_name, qty, unit, is_optional in recipe["ingredients"]:
            cursor.execute(
                "SELECT id FROM ingredients WHERE name = %s", (ing_name.lower().strip(),)
            )
            row = cursor.fetchone()
            if not row:
                continue
            cursor.execute(
                """INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, is_optional)
                   VALUES (%s, %s, %s, %s, %s)""",
                (recipe_id, row[0], qty, unit, 1 if is_optional else 0),
            )

        for step_number, instruction in enumerate(recipe["steps"], start=1):
            cursor.execute(
                "INSERT INTO steps (recipe_id, step_number, instruction) VALUES (%s, %s, %s)",
                (recipe_id, step_number, instruction),
            )
