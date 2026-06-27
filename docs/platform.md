# Mango Platform

Mango Tree is a local-first, permissioned agent platform. It routes requests through a coordinator, delegates broad reasoning to a planner, and executes narrow work through LangGraph workflows and app-scoped tools. The frontend consumes APIs; agents consume tools. Both reach the same app services.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, TanStack Router/Query, Zustand, Tailwind, shadcn/ui |
| API | Django REST Framework |
| Backend | Django, ASGI/Uvicorn, Celery, Redis |
| Agents | LangGraph under `utils/agents/` |
| Database | PostgreSQL, pgvector |
| Models | Llama-CPP, cloud provider abstraction |
| Storage | S3-compatible object storage |
| Python tooling | `uv` |

## Repository Layout

```text
.
|-- config/                 # Django project (settings, urls, asgi, wsgi) + runtime YAML
|-- data/                   # runtime artifacts, storage, thumbnails
|-- docs/
|   |-- platform.md         # this file
|   |-- api.md              # HTTP API contract
|   `-- skills/             # agent instruction packs (symlinked from .cursor/, .claude/, and .codex/)
|-- web/                    # React/Vite SPA
|-- NewApps/                # staging drop-zone for apps awaiting migration
|-- utils/                  # backend container
|   |-- agents/             # coordinator, planner, memory, tools, providers
|   |-- api/                # DRF routes, serializers, middleware, schemas
|   |-- apps/{name}/        # backend, frontend, agent, shared per app
|   |-- shared/             # auth, permissions, storage, search, embeddings, events
|   |-- scripts/            # dev + link-skills scripts
|   `-- tests/              # grouped by subsystem
`-- pyproject.toml
```

### App Standard

```text
utils/apps/{app_name}/
|-- backend/{api,models,services,tasks}/
|-- frontend/{components,pages,hooks}/
|-- agent/{tools.py,prompts.py}/
`-- shared/
```

Registered apps: projects, notes, jobs, recipes, imdbspy, timekeeper, **media_viewer** (local artifacts and media viewer), **exercise** (workout/routine/equipment/history tracking with Strava import; migrated from the standalone WorkoutTracker app), **projectmanager** (projects, goals, deadlines, and a Gantt timeline; migrated from the standalone ProjectManager app), **calendar** (weekly schedules + a dated calendar of merged events with themed PDF export; migrated from a standalone Flask app). media_viewer, exercise, projectmanager, and calendar are fully implemented app modules.

**Code placement:** business logic in `backend/services/` or `shared/`; agent tools call services; UI in `web/src/` or `utils/apps/{app}/frontend/`; no business logic in `web/src/services/` beyond API clients.

## Architecture

```text
User -> web/ -> utils/api/ -> utils/apps/{app}/backend/services/
User -> utils/agents/coordinator -> utils/agents/planner OR utils/apps/{app}/agent/tools -> same services
```

| Layer | Path | Role |
| --- | --- | --- |
| Frontend | `web/` | Dashboard, chat, command palette; API clients only |
| API | `utils/api/` | DRF surface for the UI |
| Agents | `utils/agents/` | LangGraph orchestration |
| Apps | `utils/apps/{name}/` | Domain logic, UI fragments, agent tools |
| Shared | `utils/shared/` | Auth, permissions, storage, search, embeddings, events |

The coordinator routes and validates. The planner reasons and delegates. Specialists use app tools with scoped permissions enforced in code, not prompts.

## Data Flow

**UI:** `web/src/services/` → `utils/api/routes/` → app services → PostgreSQL/S3/Redis → TanStack Query → React.

**Agents:** coordinator → planner or app workflow → `utils/agents/tools/` → `utils/apps/{app}/agent/tools.py` → app services → events/artifacts.

**Background:** API or agent trigger → Celery task → app services → `utils/shared/events/`.

## Frontend

Target: React/Vite SPA with swappable shadcn/Tailwind themes (Canva-inspired default). The `/chat` route uses `AgentWorkspaceLayout` for the agent workspace shell.

### Routes (TanStack Router)

| Route | Data Source |
| --- | --- |
| `/dashboard` | `/api/tasks/`, app summaries |
| `/chat` | `/api/tasks/`, agent endpoints, `/api/media-viewer/artifacts/`, `/api/exercise/` (Exercise opens as a persistent workspace tab), `/api/projectmanager/` (Project Manager opens as a persistent workspace tab), `/api/calendar/` (Calendar opens as a persistent workspace tab) |
| `/projects`, `/projects/:id` | `/api/projects/` |
| `/notes`, `/notes/:id` | `/api/notes/` |
| `/jobs` | `/api/jobs/` |
| `/calendar` | `/api/calendar/events/` |
| `/agents` | `/api/agents/` |
| `/workflows` | `/api/workflows/` |
| `/tools` | `/api/tools/` |
| `/memory` | `/api/memory/` |
| `/traces/:taskId` | `/api/traces/{task_id}/` |
| `/settings` | TBD |

Future: `/recipes`, `/imdbspy`, `/timekeeper`. Do not implement a route until its endpoint exists in `docs/api.md`.

### Component Map

| Area | Path |
| --- | --- |
| Router, providers, layouts, stores | `web/src/app/` |
| UI primitives (shadcn) | `web/src/components/ui/` |
| Forms, tables, charts, markdown | `web/src/components/{forms,tables,charts,markdown}/` |
| Features (chat, workspace, dashboard, command-palette, memory, settings) | `web/src/features/` |
| Agent workspace layout (`/chat`) | `web/src/app/layouts/AgentWorkspaceLayout.tsx` composes `ChatNavRail`, resizable left `ChatWindow`, `WorkspaceHeader`, and `WorkspaceMainBody` |
| Pages | `web/src/pages/` |
| API clients, types, hooks, styles | `web/src/{services,types,hooks,lib,styles}/` |
| App UI fragments | `utils/apps/{app}/frontend/` (e.g. `media_viewer` artifact grid and viewers) |
| Apps registry | `web/src/features/workspace/apps/appRegistry.tsx` (one entry per workspace app) |

### `/chat` workspace layout

```text
┌────┬──────────────────────────┬─────────────────────────────────────────────┐
│Nav │  Left sidebar (resizable) │  Right workspace (main column)              │
│rail│                           │                                             │
│ 💬 │  ChatWindow               │  WorkspaceHeader (Apps home + app tabs)     │
│ 📨 │  (left sidebar is chat)   │  WorkspaceMainBody: Apps overview or app    │
│ 🏋│                           │  content (Mailbox / Exercise / Projects /   │
│ 📁 │                           │  Artifacts) or ephemeral artifact viewer    │
└────┴──────────────────────────┴─────────────────────────────────────────────┘
```

The nav rail (~48px) has a Chat button (re-opens the chat sidebar) plus one quick-launch icon per registered app; the left sidebar stays on chat and apps open as tabs in the right workspace.

### Workspace tabs (Apps home + app tabs + ephemeral)

The right column header tab bar has a single pinned **Apps** home tab plus **app tabs** and **ephemeral tabs**. The apps are defined by a registry (`web/src/features/workspace/apps/appRegistry.tsx`); adding an entry there wires the app into the launcher, header tabs, nav-rail quick-launch, and main-body routing.

| Tab type | Behavior |
| --- | --- |
| Apps home | Always visible (leftmost); `WorkspaceMainBody` shows the Apps overview launcher — a card per registered app with name + description |
| App tab | Opened from the overview card or the nav-rail icon; closeable; renders the app's `Component` (Mailbox, Exercise, Projects, Artifacts) |
| Ephemeral | Opened when the user selects an artifact from the Artifacts tab; label is **Artifacts** (italic); viewer shows the selected file |
| Default | When no app/ephemeral tab is active, the Apps overview is shown |

App tabs open/close through the generic store actions `openAppTab(id)` / `closeAppTab(id)`. Open app tabs and the ephemeral tab are **not persisted** across reloads; the Apps home is the landing surface on load.

## Local runtime data

User-uploaded artifacts are stored under `data/artifacts/` (gitignored). The backend creates this tree on first write:

```text
data/artifacts/
├── manifest.json       # authoritative index
├── storage/            # raw bytes ({id}{ext})
└── thumbnails/         # generated previews ({id}.webp)
```

Configure via `config/artifacts.yaml` and optional `MANGO_ARTIFACTS_ROOT`. See `utils/apps/media_viewer/README.md` and `docs/api.md` for endpoints and permission boundaries (read/write scoped to `{artifacts.root}/**` only).

The **exercise** app preserves the legacy WorkoutTracker SQLite database at `data/exercise/workouttracker.db` (gitignored). It is bound through a dedicated `exercise` Django connection with `managed = False` models (schema unchanged); override the path with `MANGO_EXERCISE_DB`. See `utils/apps/exercise/README.md`.

The **projectmanager** app preserves the legacy ProjectManager SQLite database at `data/projectmanager/projectmanager.db` (gitignored). It is bound through a dedicated `projectmanager` Django connection with `managed = False` models (schema unchanged); override the path with `MANGO_PROJECTMANAGER_DB`. It opens as a persistent workspace tab (board / timeline / deadlines). See `utils/apps/projectmanager/README.md`.

The **calendar** app has no database: it keeps its JSON stores (`calendar.json` + `schedules/*.json` + `instructions.md`) under `data/calendar/` (gitignored), seeded on first run from a committed copy in `backend/seed/` and overridable with `MANGO_CALENDAR_DATA_DIR`. Following the mailbox pattern, it is not a Django app (no models/migrations/INSTALLED_APPS entry); its routes mount at `/api/calendar/` and it opens as a persistent workspace tab (calendar / schedules). The filesystem scope is confined to `{calendar_root}/**` via `config/permissions.yaml`. See `utils/apps/calendar/README.md`.

## Build Sequence

1. ~~Replace `web/` Astro skeleton with React/Vite shell.~~ (done — workspace shell at `/chat`)
2. Define app boundaries under `utils/apps/{app_name}`.
3. Build shared API and tool interfaces.
4. Migrate one app at a time (Flask apps: keep models/services/API; remove templates/static/routing).
5. Connect agents to the same app tools used by the UI.
6. Delete old frontend artifacts.

## Deployment

**Prerequisites:** Python 3.13+ (`uv`), Node/npm, PostgreSQL+pgvector, Redis, optional S3.

```bash
# Backend
uv sync && uv run manage.py migrate && uv run manage.py runserver
uv run uvicorn config.django.asgi:application --reload
uv run celery -A config.django worker --loglevel=info
uv run pytest

# Frontend (target)
cd web && npm install && npm run dev && npm run build
```

Config lives in `config/` (Django settings, models/agents/tools/permissions/workflows YAML). Secrets via `.env` only.

| Service | Default |
| --- | --- |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| Django/DRF | localhost:8000 |
| Vite dev | localhost:5173 |

## Testing

Tests prove routing, permissions, schemas, and boundaries — not just happy paths.

```text
utils/tests/{agents,api,utils/apps,utils/shared,web}/
```

Core rules:

- Tools reject calls outside `allowed_tools`, paths, namespaces, and datasets.
- DRF views and agent tools must enforce the same permissions for equivalent operations.
- Agent tools must call the same services as DRF views.
- Include denial cases, not only success flows.
- Mock local inference unless testing the model runtime.

## Skills

Detailed conventions live in `docs/skills/` (symlinked from `.cursor/skills/`, `.claude/skills/`, and `.codex/skills/`).

- **global** — always-on step-and-commit workflow for every implementation session
- **repo-structure**, **django-backend**, **app-modules**, **website-architecture**, **ui-frontend**, **plan** — domain-specific guidance

On Windows after clone, run `./utils/scripts/link-skills.ps1` if skill links check out as plain text files.

## Migration Note

The retired `src/agent_runtime/` layout maps to: orchestration → `utils/agents/coordinator/`, general agent → `utils/agents/planner/`, memory → `utils/agents/memory/`, tools → `utils/agents/tools/`, inference → `utils/agents/providers/`, specialists → `utils/apps/{app}/agent/`.
