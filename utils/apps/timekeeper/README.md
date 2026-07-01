# Time Keeper

Domain app module under `utils/apps/timekeeper/`. Migrated from the standalone
**TimeKeeper** (Flask / raw-SQLite) app: logs how time is spent in 5-minute
blocks across user-defined categories, and reports daily/period statistics.

## Layout

```text
utils/apps/timekeeper/
├── backend/
│   ├── api/        # DRF views and serializers (thin)
│   ├── models/     # managed=False models bound to the legacy SQLite tables
│   └── services/   # logs, categories (domain logic)
├── frontend/       # React fragments consumed by the web/ shell
├── agent/          # LangGraph tools (tools.py) and prompts (prompts.py)
└── shared/         # DTOs (schemas.py), typed errors, constants, interval math
```

## Data store

The original database is preserved unchanged (Strategy A — bind to existing). It
lives at `data/timekeeper/timekeeper.db` (gitignored) and is reached through a
dedicated `timekeeper` Django database connection plus a router; the models are
`managed = False` so Django never alters the schema. Override the path with
`MANGO_TIMEKEEPER_DB`.

Tables:

- `time_logs` — one row per contiguous tracked interval: `date` (`YYYY-MM-DD`),
  `start_time` (`HH:MM`), `duration` (minutes), optional `notes`, `category_id`,
  `subcategory_id`, and `created_at`.
- `settings` — a key/value store; the single `categories` row holds the JSON
  category taxonomy (`[{id, name, colorId, subcategories:[{id, name, l}]}]`).

Saving a day is **replace semantics**: the day's existing rows are deleted and
rewritten from a list of painted 5-minute block indices, which are grouped into
contiguous same-subcategory chunks (`shared/intervals.py`).

## HTTP API

Base prefix `/api/timekeeper/`. Documented in `docs/api.md` under **Time Keeper**.
DRF routes: `utils/api/routes/timekeeper.py`. Views call `backend/services/` only.

## Agent tools

Registered in `config/tools.yaml`. Each tool calls the same service as its
matching DRF endpoint (API ↔ agent parity):

- `timekeeper_list_logs` — list tracked intervals (optionally for one date).
- `timekeeper_daily_totals` — total tracked minutes per day.
- `timekeeper_list_categories` — the category/subcategory taxonomy.
- `timekeeper_save_day` — replace a day's intervals (**confirm-gated**; overwrites).
- `timekeeper_delete_log` — delete a single log row (**confirm-gated**).

Fine-grained single-log edits (`PUT /logs/{id}`) and replacing the whole category
taxonomy (`PUT /categories`) are **API-only** — they are UI-driven config actions
with no realistic agent use.

## Frontend

Imported by `web/` via the `@timekeeper` Vite alias. The API client is
`web/src/services/timekeeperClient.ts` (request/response only); data fetching uses
TanStack Query hooks in `frontend/hooks/`. The UI opens as a **persistent
workspace tab** rendering `frontend/pages/TimekeeperWorkspace.tsx`, with four
views: **Tracker** (paint a day of 5-minute blocks), **Dashboard** (period
statistics), **Logs** (history table), and **Categories** (manage categories and
subcategory shades).

## Rules

- Business logic lives in `backend/services/` or `shared/`.
- Agent tools call services; never duplicate domain logic.
- DRF views are thin wrappers over services.
- Never issue DDL against the legacy data tables.

See `docs/skills/app-modules/`.
