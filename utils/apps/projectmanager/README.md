# Project Manager

Domain app module under `utils/apps/projectmanager/`. Migrated from the
standalone **ProjectManager** (Flask/SQLAlchemy) app: tracks projects, their
goals, deadlines, and a Gantt-style timeline.

## Layout

```text
utils/apps/projectmanager/
├── backend/
│   ├── api/        # DRF views and serializers (thin)
│   ├── models/     # managed=False models bound to the legacy SQLite tables
│   └── services/   # projects, goals, categories, timeline (domain logic)
├── frontend/       # React fragments consumed by the web/ shell
├── agent/          # LangGraph tools (tools.py) and prompts (prompts.py)
└── shared/         # DTOs (schemas.py), typed errors, constants, deadline/timeline utils
```

## Data store

The original database is preserved unchanged (Strategy A — bind to existing).
It lives at `data/projectmanager/projectmanager.db` (gitignored) and is reached
through a dedicated `projectmanager` Django database connection plus a router;
the models are `managed = False` so Django never alters the schema. Override the
path with `MANGO_PROJECTMANAGER_DB`.

Tables: `category`, `project`, `goal`. Project status is one of
`Active`/`Completed`/`On-Hold`/`Abandoned`; goal status is `Pending`/`Completed`.
The legacy data has zero orphan rows, so foreign-key enforcement is left at
Django's default (ON).

## HTTP API

Base prefix `/api/projectmanager/`. Documented in `docs/api.md` under **Project
Manager**. DRF routes: `utils/api/routes/projectmanager.py`. Views call
`backend/services/` only.

## Agent tools

Registered in `config/tools.yaml`. Each tool calls the same service as its
matching DRF endpoint (API ↔ agent parity):

- `projectmanager_list_projects` — list projects with category/status/progress.
- `projectmanager_list_goals_with_deadlines` — goals with a deadline, soonest first.
- `projectmanager_create_project` — create a project (`title`, `category_name`, …).
- `projectmanager_create_goals` — add one or more goals to an existing project.

## Frontend

Imported by `web/` via the `@projectmanager` Vite alias. The API client is
`web/src/services/projectmanagerClient.ts` (request/response only); data fetching
uses TanStack Query hooks in `frontend/hooks/useProjectManager.ts`.

The UI opens as a **persistent workspace tab** (the FolderKanban icon on the chat
nav rail), appearing next to the other workspace tabs in `WorkspaceHeader` and
rendering inside `WorkspaceMainBody` via
`frontend/pages/ProjectManagerWorkspace.tsx`. It has three views — **Board**
(status columns of project cards with goals), **Timeline** (Gantt), and
**Deadlines** (goals due/overdue). The active view is persisted in the workspace
store (`projectManagerView`).

All component styles live in `frontend/styles/projectmanager.css` and every class
is prefixed `projectmanager-` so they never collide with the rest of the app.

## Rules

- Business logic lives in `backend/services/` or `shared/`.
- Agent tools call services; never duplicate domain logic.
- DRF views are thin wrappers over services.
- Never issue DDL against the legacy data tables.

See `docs/skills/app-modules/`.
