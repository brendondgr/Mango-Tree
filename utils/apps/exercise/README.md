# Exercise

Domain app module under `utils/apps/exercise/`. Migrated from the standalone
**WorkoutTracker** FastAPI app: tracks workouts, weekly routines, equipment, and
workout history, with optional Strava activity import.

## Layout

```text
utils/apps/exercise/
├── backend/
│   ├── api/        # DRF views and serializers (thin)
│   ├── models/     # managed=False models bound to the legacy SQLite tables
│   ├── services/   # workouts, routines, equipment, history, strava (domain logic)
│   └── tasks/      # Celery tasks (Strava sync)
├── frontend/       # React fragments consumed by the web/ shell
├── agent/          # LangGraph tools (tools.py) and prompts (prompts.py)
└── shared/         # DTOs (schemas.py), typed errors (errors.py), constants
```

## Data store

The original database is preserved unchanged (Strategy A — bind to existing).
It lives at `data/exercise/workouttracker.db` (gitignored) and is reached
through a dedicated `exercise` Django database connection plus a router; the
models are `managed = False` so Django never alters the schema.

Tables: `workouts`, `routines`, `equipment`, `history`. JSON payloads
(`exercises`, `routines.workouts`) are stored as TEXT, exactly as the legacy
app stored them.

## HTTP API

Base prefix `/api/exercise/`. Documented in `docs/api.md` under **Exercise**
(populated in Stage 5). DRF routes: `utils/api/routes/exercise.py`. Views call
`backend/services/` only.

## Agent tools

Registered in `config/tools.yaml` (Stage 6). Each tool calls the same service
as its matching DRF endpoint. Destructive tools require `confirm: true`. Strava
network access is scoped in `config/permissions.yaml`.

## Frontend

Imported by `web/` via the `@exercise` Vite alias. The API client is
`web/src/services/exerciseClient.ts` (request/response only); data fetching uses
TanStack Query hooks in `frontend/hooks/useExercise.ts`.

The UI opens as a **persistent workspace tab** (the dumbbell icon on the chat
nav rail), appearing next to Overview/Assets/History in `WorkspaceHeader` and
rendering inside `WorkspaceMainBody` via `frontend/pages/ExerciseWorkspace.tsx`.
Unlike the artifacts ephemeral tab, it survives pinned-tab switches and only
closes via its tab's ✕ button. The active sub-view (dashboard/workouts/routines/
equipment/history) is persisted in the workspace store.

## Rules

- Business logic lives in `backend/services/` or `shared/`.
- Agent tools call services; never duplicate domain logic.
- DRF views are thin wrappers over services.
- Never issue DDL against the legacy data tables.

See `docs/skills/app-modules/`.
