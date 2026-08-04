# Utils Apps

Domain app modules. The standard layout is documented in
`docs/skills/app-modules/`; per-app deviations are noted below.

## Implemented apps

Eight apps are built, routed under `/api/{app}/`, registered as agent tools in
`config/tools.yaml`, and available as workspace tabs via
`web/src/features/workspace/apps/appRegistry.tsx`.

| App | Tools | Store | Notes |
| --- | --- | --- | --- |
| `mailbox/` | 10 | files under `data/mailbox/` | IMAP/SMTP accounts, folders, message read + move/mark/delete/reply. Irreversible tools require `confirm: true` |
| `calendar/` | 12 | JSON under `data/calendar/` | Weekly schedules merged with dated events, free-slot search, themed PDF export |
| `exercise/` | 15 | SQLite `data/exercise/workouttracker.db` | Workouts, routines, equipment, history, Strava import. `managed = False` |
| `recipes/` | 7 | SQLite `data/recipes/recipes.db` | Recipe CRUD, pantry matching, LLM recipe-text parser. `managed = False`, seeded on first run |
| `imdbspy/` | 6 | SQLite `data/imdbspy/imdbtracker.db` | IMDb scraper, weighted Fun/Grit/Comfort ratings, media cache. Django-managed with migrations |
| `timekeeper/` | 5 | SQLite `data/timekeeper/timekeeper.db` | 5-minute block logging across categories, daily stats. `managed = False` |
| `projectmanager/` | 4 | SQLite `data/projectmanager/projectmanager.db` | Projects, goals, deadlines, timeline. `managed = False` |
| `media_viewer/` | 4 | files under `data/artifacts/` | Artifact upload, manifest, thumbnails, streaming |

## Placeholders

`jobs/`, `notes/`, and `projects/` contain a README and nothing else — no
`backend/`, `frontend/`, `agent/`, or `shared/` directory, no routes, no tools,
no workspace tab. Their READMEs describe the target layout, not what exists.

## Layout in practice

| Directory | Present in |
| --- | --- |
| `backend/api/`, `backend/services/` | all eight |
| `backend/models/` | exercise, imdbspy, projectmanager, recipes, timekeeper. Absent from calendar, mailbox, media_viewer — those are file stores with no ORM models |
| `backend/tasks/` | exercise, imdbspy, media_viewer, timekeeper only |
| `agent/tools.py`, `agent/prompts.py` | all eight |
| `frontend/` | all eight |
| `shared/` | all eight |

App UI is a hybrid: each app's own pages and components live in
`utils/apps/{app}/frontend/` and are imported through Vite path aliases
(`@calendar`, `@mailbox`, …) declared in `web/vite.config.ts`. Shared shell
chrome — nav rail, tab strip, chat, settings — lives in `web/src/`.

Not every app is a Django app. Only those with models are in `INSTALLED_APPS`;
`calendar` and `mailbox` are wired by URL include alone.

## Rules

- Domain logic lives in `backend/services/` or `shared/`.
- Agent tools call services; they never re-implement domain logic.
- DRF views stay thin.
- A new agent tool needs both a function in `agent/tools.py` and an entry in
  `config/tools.yaml` — the registry is config-driven, not decorator-driven.
