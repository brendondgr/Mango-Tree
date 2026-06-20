# Mango Platform

Mango Tree is a local-first, permissioned agent platform. It routes requests through a coordinator, delegates broad reasoning to a planner, and executes narrow work through LangGraph workflows and app-scoped tools. The frontend consumes APIs; agents consume tools. Both reach the same app services.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, TanStack Router/Query, Zustand, Tailwind, shadcn/ui |
| API | Django REST Framework |
| Backend | Django, ASGI/Uvicorn, Celery, Redis |
| Agents | LangGraph under `agents/` |
| Database | PostgreSQL, pgvector |
| Models | Llama-CPP, cloud provider abstraction |
| Storage | S3-compatible object storage |
| Python tooling | `uv` |

## Repository Layout

```text
.
|-- agents/                 # coordinator, planner, memory, tools, providers
|-- api/                    # DRF routes, serializers, middleware, schemas
|-- config/                 # Django settings and runtime YAML
|-- docs/
|   |-- platform.md         # this file
|   |-- api.md              # HTTP API contract
|   `-- skills/             # agent instruction packs (symlinked from .cursor/, .claude/, and .codex/)
|-- utils/
|   |-- apps/{name}/        # backend, frontend, agent, shared per app
|   `-- shared/             # auth, permissions, storage, search, embeddings, events
|-- tests/
|-- web/                    # React/Vite SPA
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

Registered apps: projects, notes, jobs, calendar, recipes, imdbspy, exercise, timekeeper, **media_viewer** (first fully implemented app module — local artifacts and media viewer).

**Code placement:** business logic in `backend/services/` or `shared/`; agent tools call services; UI in `web/src/` or `utils/apps/{app}/frontend/`; no business logic in `web/src/services/` beyond API clients.

## Architecture

```text
User -> web/ -> api/ -> utils/apps/{app}/backend/services/
User -> agents/coordinator -> agents/planner OR utils/apps/{app}/agent/tools -> same services
```

| Layer | Path | Role |
| --- | --- | --- |
| Frontend | `web/` | Dashboard, chat, command palette; API clients only |
| API | `api/` | DRF surface for the UI |
| Agents | `agents/` | LangGraph orchestration |
| Apps | `utils/apps/{name}/` | Domain logic, UI fragments, agent tools |
| Shared | `utils/shared/` | Auth, permissions, storage, search, embeddings, events |

The coordinator routes and validates. The planner reasons and delegates. Specialists use app tools with scoped permissions enforced in code, not prompts.

## Data Flow

**UI:** `web/src/services/` → `api/routes/` → app services → PostgreSQL/S3/Redis → TanStack Query → React.

**Agents:** coordinator → planner or app workflow → `agents/tools/` → `utils/apps/{app}/agent/tools.py` → app services → events/artifacts.

**Background:** API or agent trigger → Celery task → app services → `utils/shared/events/`.

## Frontend

Target: React/Vite SPA with swappable shadcn/Tailwind themes (Canva-inspired default). The `/chat` route uses `AgentWorkspaceLayout` for the agent workspace shell.

### Routes (TanStack Router)

| Route | Data Source |
| --- | --- |
| `/dashboard` | `/api/tasks/`, app summaries |
| `/chat` | `/api/tasks/`, agent endpoints, `/api/media-viewer/artifacts/` |
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

Future: `/recipes`, `/imdbspy`, `/exercise`, `/timekeeper`. Do not implement a route until its endpoint exists in `docs/api.md`.

### Component Map

| Area | Path |
| --- | --- |
| Router, providers, layouts, stores | `web/src/app/` |
| UI primitives (shadcn) | `web/src/components/ui/` |
| Forms, tables, charts, markdown | `web/src/components/{forms,tables,charts,markdown}/` |
| Features (chat, workspace, dashboard, command-palette, memory, settings) | `web/src/features/` |
| Agent workspace layout (`/chat`) | `web/src/app/layouts/AgentWorkspaceLayout.tsx` composes `ChatNavRail`, resizable left sidebar (`ChatWindow` or `ArtifactsSidebar`), `WorkspaceHeader`, `MediaViewerShell` or `WorkspaceMainBody` |
| Pages | `web/src/pages/` |
| API clients, types, hooks, styles | `web/src/{services,types,hooks,lib,styles}/` |
| App UI fragments | `utils/apps/{app}/frontend/` (e.g. `media_viewer` artifacts sidebar and viewers) |

### `/chat` workspace layout

```text
┌────┬──────────────────────────┬─────────────────────────────────────────────┐
│Nav │  Left sidebar (resizable) │  Right workspace (main column)              │
│rail│                           │                                             │
│ 💬 │  Chat mode: ChatWindow    │  WorkspaceHeader (pinned + ephemeral tabs)  │
│ 📁 │  Artifacts: artifact grid │  WorkspaceMainBody or app viewer content      │
└────┴──────────────────────────┴─────────────────────────────────────────────┘
```

The nav rail (~48px) switches left sidebar content only; the right workspace keeps its own state.

### Workspace tabs (pinned + ephemeral)

The right column header tab bar has **pinned tabs** (Overview, Assets, History) and **ephemeral tabs** for app content opened from the left sidebar (artifacts first; other apps follow the same pattern).

| Tab type | Behavior |
| --- | --- |
| Pinned | Always visible; show placeholder content in `WorkspaceMainBody` |
| Ephemeral | Opened when user selects an item (e.g. artifact); label is **Artifacts** (italic); viewer shows the selected file |
| Auto-close | Switching to any pinned tab closes the ephemeral tab and unmounts the viewer |
| Re-open | User must select the item again from the app sidebar (e.g. Artifacts nav) |

Ephemeral tab state is **not persisted** across reloads. One ephemeral tab at a time; opening another item replaces it.

## Local runtime data

User-uploaded artifacts are stored under `data/artifacts/` (gitignored). The backend creates this tree on first write:

```text
data/artifacts/
├── manifest.json       # authoritative index
├── storage/            # raw bytes ({id}{ext})
└── thumbnails/         # generated previews ({id}.webp)
```

Configure via `config/artifacts.yaml` and optional `MANGO_ARTIFACTS_ROOT`. See `utils/apps/media_viewer/README.md` and `docs/api.md` for endpoints and permission boundaries (read/write scoped to `{artifacts.root}/**` only).

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
tests/{agents,api,utils/apps,utils/shared,web}/
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

The retired `src/agent_runtime/` layout maps to: orchestration → `agents/coordinator/`, general agent → `agents/planner/`, memory → `agents/memory/`, tools → `agents/tools/`, inference → `agents/providers/`, specialists → `utils/apps/{app}/agent/`.
