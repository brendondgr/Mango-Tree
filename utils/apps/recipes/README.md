# Recipes

Domain app module under `utils/apps/recipes/`. A recipe book ported from a
standalone Flask app ("ShortSpork"): browse and filter recipes, match them
against the ingredients you have on hand ("pantry match"), and create / edit /
delete recipes with structured ingredients and steps. Reachable identically from
the DRF API and from curated agent tools, over the same SQLite store.

## Layout

```text
utils/apps/recipes/
├── backend/
│   ├── api/            # DRF views + serializers (thin)
│   ├── models/         # managed=False models bound to the legacy SQLite schema
│   ├── db_router.py    # routes recipes models to the `recipes` connection
│   ├── apps.py         # RecipesBackendConfig (label = recipes)
│   └── services/
│       ├── store.py        # DB path + schema DDL + seed-on-first-run
│       ├── ingredients.py  # ingredient catalog (by category, search)
│       ├── recipes.py      # recipe CRUD + pantry match % + distinct filters
│       ├── images.py       # recipe image upload (filesystem)
│       └── parser.py        # "AI Chef" recipe-text → structured recipe (LLM)
├── frontend/           # React browse grid + recipe editor, via the @recipes alias
├── agent/              # LangGraph tools (tools.py) and prompts (prompts.py)
└── shared/             # DTOs, typed errors, and constants
    ├── schemas.py      # DTOs (RecipeSummary, RecipeDetail, Ingredient, NewRecipe)
    ├── errors.py       # RecipesError + typed subclasses (5 platform codes)
    └── constants.py    # DB alias, category order, cuisine/meal options
```

## Data store (Strategy A — bind to existing schema)

SQLite at `data/recipes/recipes.db` (gitignored), bound through a dedicated
`recipes` Django connection with `managed = False` models so Django never issues
DDL. Override the path with `MANGO_RECIPES_DB`. Unlike the other legacy-SQLite
apps, there is no committed database: the schema and a small set of sample
recipes are **seeded on first run** by `backend/services/store.py`
(`ensure_initialized()`), non-destructively.

Five tables, preserved exactly from the source app:

| Table | Purpose |
| --- | --- |
| `recipes` | title, description, image_url, servings, cuisine_region, meal_type |
| `ingredients` | unique ingredient name + category |
| `recipe_ingredients` | recipe↔ingredient link with quantity, unit, is_optional |
| `steps` | ordered instructions per recipe |
| `recipe_images` | ordered image URLs per recipe |

## HTTP API

Base prefix `/api/recipes/`. Documented in `docs/api.md` under **Recipes**. DRF
routes: `utils/api/routes/recipes.py`. Views call `backend/services/` only — the
same services the agent tools call (API ↔ agent parity).

## Agent tool contract (curated)

Single source of truth. `agent/tools.py`, `agent/prompts.py`, and
`config/tools.yaml` derive from this table and must not drift.

| Tool name | Args | Kind | Gate |
| --- | --- | --- | --- |
| `recipes_list_recipes` | — | read | none |
| `recipes_get_recipe` | `recipe_id` | read | none |
| `recipes_find_by_ingredients` | `ingredient_names?`, `ingredient_ids?`, `meal_types?`, `cuisine_regions?` | read | none |
| `recipes_list_ingredients` | — | read | none |
| `recipes_create_recipe` | `recipe` | mutating | none |
| `recipes_update_recipe` | `recipe_id`, `recipe` | mutating | none |
| `recipes_delete_recipe` | `recipe_id`, `confirm=false` | irreversible | **`confirm: true`** |

The recipe-text parser (`POST parse/`), image upload (`POST images/`), and the
filter-option lookups are **API-only by deliberate choice** — the agent can
create recipes directly with structured data, so it has no need for the
text-parsing or file-upload surfaces. Confirm gates are checked in `tools.py`;
filesystem scope is enforced via `config/permissions.yaml` (`recipes_data`).

## Frontend

Imported by `web/` via the `@recipes` Vite alias. API client:
`web/src/services/recipesClient.ts`; data fetching uses TanStack Query hooks. The
UI opens as a **persistent workspace tab**: a browse view (filter sidebar +
pantry + recipe grid + detail panel with a live servings scaler) and an editor
view (create / edit form with dynamic ingredient and step rows plus the "AI Chef"
text parser).

## Rules

- Business logic lives in `backend/services/` or `shared/`.
- Agent tools call services; never duplicate domain logic.
- DRF views are thin wrappers over services.
- Uploaded filenames are randomized; image writes are confined to the recipes
  data directory.

See `docs/skills/app-modules/`.
