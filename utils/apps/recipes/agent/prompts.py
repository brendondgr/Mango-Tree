"""Planner-facing guidance for the recipes tools. Kept short and behavioral: when
to reach for each tool, how ids flow, and which operation needs confirmation."""

RECIPES_TOOLS_PROMPT = """\
Recipe book tools (recipes + pantry ingredients):

Read first to ground answers:
- recipes_list_recipes — all recipes as summary cards (id, title, servings,
  cuisine_region, meal_type, images). IDs are integers; reuse the exact id.
- recipes_get_recipe — full detail for one recipe_id (structured ingredients with
  quantity/unit/optional, and ordered steps).
- recipes_list_ingredients — the pantry catalog (id, name, category). Ingredient
  names are stored lowercase.
- recipes_find_by_ingredients — "what can I make with X?" Pass ingredient_names
  (strings) and/or ingredient_ids, optionally meal_types / cuisine_regions.
  Returns recipes ranked by match_percentage (share of required ingredients you
  have); best matches first.

Write:
- recipes_create_recipe — create a recipe. `recipe` is an object with `title`
  (string), `ingredients` (non-empty list of {name, quantity?, unit?, category?,
  is_optional?}) and `steps` (non-empty list of strings). Optional: `description`,
  `servings` (int, default 4), `cuisine_region`, `meal_type`, `image_urls`.
- recipes_update_recipe — replace an existing recipe wholesale (`recipe_id` plus
  the same `recipe` object as create; ingredients/steps are fully replaced).
- recipes_delete_recipe — delete a recipe. Irreversible: requires `confirm: true`.
  Confirm with the user first, then call again with confirm true.

Notes:
- IDs are integers returned by read tools; never invent an id.
- Errors carry a stable `code` (validation_error, not_found, permission_denied);
  surface the message rather than retrying blindly.
"""
