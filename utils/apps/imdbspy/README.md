# IMDbSpy

Domain app module under `utils/apps/imdbspy/`. A personal movie/TV tracker
ported from a standalone Flask app. Add titles by IMDb URL/ID (metadata + poster
+ cast headshots are scraped and cached locally), mark them **seen / not seen /
abandoned**, and rate them with three weighted scales (**Fun / Grit / Comfort**).
Reachable identically from the DRF API and from curated agent tools, over the
same dedicated SQLite store and media cache.

## Layout

```text
utils/apps/imdbspy/
├── backend/
│   ├── api/          # DRF views + serializers (thin)
│   ├── models/       # managed Django models (media_items, rating_weights)
│   ├── db_router.py  # routes imdbspy models to the dedicated SQLite connection
│   ├── apps.py       # ImdbspyBackendConfig (label "imdbspy")
│   └── services/
│       ├── scraper.py       # IMDb scraper (Cinemagoer + JSON-LD/HTML), injectable
│       ├── media_items.py   # list/add/status/review/seasons/delete/refresh
│       ├── weights.py       # rating-weights read/update + score recalculation
│       └── media.py         # sanitized media-asset path resolution (serving)
├── frontend/         # React workspace tab, via the @imdbspy alias
├── agent/            # LangGraph tools (tools.py) and prompts (prompts.py)
└── shared/           # errors, constants, DTOs, and the pure score math
    ├── ratings.py      # weighted Fun/Grit/Comfort score (single source of truth)
    ├── errors.py       # ImdbspyError + typed subclasses (5 platform codes)
    ├── constants.py    # DB alias, statuses, scale types, media dirs
    └── schemas.py      # input DTOs
```

## Data store

A dedicated SQLite database at `data/imdbspy/imdbtracker.db` (override
`MANGO_IMDBSPY_DB`), owned by Django (`managed = True`) and routed by
`ImdbspyRouter`. Two tables:

| Table | Shape |
| --- | --- |
| `media_items` | one row per tracked title: IMDb id, title, kind, genres, rating, cast, image paths, status, weighted-rating fields |
| `rating_weights` | one row per scale (`fun`/`grit`/`comfort`) holding the criterion weights (seeded on migrate) |

Scraped images are cached under `data/imdbspy/media/{actors,tv-movie}/` (override
`MANGO_IMDBSPY_MEDIA_DIR`) and served through a sanitized asset endpoint. `data/`
is gitignored, matching the other app modules.

## HTTP API

Base prefix `/api/imdbspy/`. Documented in `docs/api.md` under **IMDbSpy**. DRF
routes: `utils/api/routes/imdbspy.py`. Views call `backend/services/` only — the
same services the agent tools call (API ↔ agent parity).

## Agent tool contract (curated)

Single source of truth. `agent/tools.py`, `agent/prompts.py`, and
`config/tools.yaml` derive from this table and must not drift.

| Tool name | Args | Kind | Gate |
| --- | --- | --- | --- |
| `imdbspy_list_media` | `status?`, `kind?`, `search?`, `limit?`, `offset?` | read | none |
| `imdbspy_add_media` | `urls` | mutating (network) | none |
| `imdbspy_set_status` | `item_id`, `status` | mutating | none |
| `imdbspy_update_review` | `item_id`, `scale_type?`, `*_rating?`, `user_review?`, `seasons_seen?` | mutating | none |
| `imdbspy_delete_media` | `item_id`, `confirm=false` | irreversible | **`confirm: true`** |
| `imdbspy_refresh_metadata` | — | mutating (network) | none |

**Enforcement is in code, never in the prompt.** The delete confirm gate is
checked in `tools.py`; filesystem + network scopes are declared in
`config/permissions.yaml` (`imdbspy_media`, `imdbspy_scrape`). **Rating-weights
GET/PUT are API-only** (a UI configuration surface) — the agent has no realistic
reason to rewrite the weight math.

## Frontend

Imported by `web/` via the `@imdbspy` Vite alias. API client:
`web/src/services/imdbspyClient.ts`; data fetching uses TanStack Query hooks in
`frontend/hooks/`. The UI opens as a **persistent workspace tab** (the Film icon
on the chat nav rail): a grid/list of tracked titles with a seen/not-seen/
abandoned switch, all/movie/TV filter, search, an add-by-link modal, and a
weighted review editor.

## Rules

- Business logic lives in `backend/services/` or `shared/`.
- Agent tools call services; never duplicate domain logic.
- DRF views are thin wrappers over services.
- Media asset paths are sanitized to block path traversal.

See `docs/skills/app-modules/`.
