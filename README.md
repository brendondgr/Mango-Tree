# Mango Tree

Mango Tree is a **local-first, permissioned agent platform**. It routes user requests through a coordinator, delegates broad reasoning to a planner, and executes focused work through LangGraph workflows and app-scoped tools. The web UI and agents both call the same backend services — agents never bypass the tool and permission layer.

## What it does

At a high level, Mango Tree is built as a system of scoped workflows and modular apps rather than one unrestricted agent:

```text
User → web/ → api/ → utils/apps/{app}/backend/services/
User → agents/coordinator → agents/planner OR app specialist → agents/tools/ → same services
```

| Layer | Path | Role |
| --- | --- | --- |
| Frontend | `web/` | React/Vite dashboard, chat workspace, command palette |
| API | `api/` | Django REST Framework surface for the UI |
| Agents | `agents/` | LangGraph orchestration: coordinator, planner, memory, tools, providers |
| Apps | `utils/apps/{name}/` | Domain logic, UI fragments, and agent tools per app |
| Shared | `utils/shared/` | Auth, permissions, storage, search, embeddings, events |
| Config | `config/` | Django settings and runtime YAML (agents, tools, permissions, workflows) |

**Coordinator** classifies requests, selects workflows, creates scoped task packages, validates structured results, and records events.

**Planner** performs broad reasoning, light inspection, planning, and delegation.

**Specialists** run narrow LangGraph workflows with app-scoped tools. Permissions are enforced in code through the tool execution context — not through prompt instructions.

### Chat workspace

The `/chat` route is the primary agent workspace. It combines:

- A **chat panel** for conversation with a local or remote LLM
- An **artifacts sidebar** for browsing uploaded and generated files
- A **workspace** with pinned tabs (Overview, Assets, History) and ephemeral viewer tabs for opened artifacts

The **media viewer** app (`utils/apps/media_viewer/`) is the first fully implemented app module. It stores artifacts under `data/artifacts/`, serves them through the API, and provides viewers for images, video, PDF, markdown, LaTeX, and text.

Additional apps (projects, notes, jobs, calendar, recipes, imdbspy, exercise, timekeeper) follow the standard layout and are being migrated incrementally. See [docs/api.md](docs/api.md) for the full HTTP contract.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, TanStack Router/Query, Zustand, Tailwind CSS, shadcn/ui |
| API | Django REST Framework |
| Backend | Django, ASGI/Uvicorn, Celery, Redis |
| Agents | LangGraph under `agents/` |
| Database | PostgreSQL with pgvector (target); SQLite for current dev/tests |
| Models | Llama-CPP and cloud provider abstraction |
| Storage | S3-compatible object storage (target); local `data/artifacts/` for media viewer |
| Python tooling | [uv](https://docs.astral.sh/uv/) |

## Prerequisites

Install these before setting up the project:

| Requirement | Version / notes |
| --- | --- |
| Python | 3.13+ |
| [uv](https://docs.astral.sh/uv/) | Python package and environment manager |
| Node.js | LTS recommended (for `web/`) |
| npm | Bundled with Node |
| LLM server | OpenAI-compatible API (default: `http://localhost:9090/v1`) — e.g. [llama.cpp server](https://github.com/ggerganov/llama.cpp) or another compatible runtime |

**Optional** (target production stack; not required for basic local development today):

- PostgreSQL with the pgvector extension
- Redis (for Celery background tasks)
- S3-compatible object storage

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd Mango-Tree
```

On Windows, if skill symlinks under `.cursor/`, `.claude/`, or `.codex/` appear as plain text files after clone, recreate them:

```powershell
./utils/scripts/link-skills.ps1
```

On macOS/Linux:

```bash
./utils/scripts/link-skills.sh
```

### 2. Python backend

Install dependencies and sync the virtual environment:

```bash
uv sync
```

For development tools (pytest, pytest-django):

```bash
uv sync --extra dev
```

Copy environment variables for agent/LLM configuration:

```bash
cp .env.example .env
```

Edit `.env` if your LLM server uses a different URL, model name, or API key.

### 3. Frontend

```bash
cd web
cp .env.example .env
npm install
cd ..
```

The frontend proxies `/api` to Django on port 32553 and `/v1` to the LLM server on port 9090 during development.

### 4. Artifact storage (media viewer)

Artifact files are written to `data/artifacts/` (gitignored). The directory is created automatically on first upload. Defaults are in [config/artifacts.yaml](config/artifacts.yaml). Override the root with:

```bash
export MANGO_ARTIFACTS_ROOT=/path/to/artifacts   # bash
$env:MANGO_ARTIFACTS_ROOT = "C:\path\to\artifacts"  # PowerShell
```

## Running locally

Start each service in its own terminal.

**Terminal 1 — Django API**

```bash
uv run manage.py runserver
```

API base: `http://localhost:8000`  
Health check: `GET http://localhost:8000/api/health/`

**Terminal 2 — Vite dev server**

```bash
cd web
npm run dev
```

UI: `http://localhost:5173`  
Open `/chat` for the agent workspace.

**Terminal 3 — LLM server**

Run your OpenAI-compatible inference server on port **9090** (or update `web/.env` and workspace LLM settings to match your endpoint).

**Optional — ASGI server**

```bash
uv run uvicorn config.django.asgi:application --reload
```

**Optional — Celery worker** (when background tasks are configured)

```bash
uv run celery -A config.django worker --loglevel=info
```

### Default ports

| Service | URL |
| --- | --- |
| Django / DRF | `http://localhost:32553` |
| Vite dev server | `http://localhost:5173` |
| LLM (OpenAI-compatible) | `http://localhost:9090` |
| PostgreSQL (future) | `localhost:5432` |
| Redis (future) | `localhost:6379` |

## Configuration

| Location | Purpose |
| --- | --- |
| `.env` | LLM base URL, model, API key for backend/agents |
| `web/.env` | `VITE_LLM_*` defaults for the frontend |
| `config/django/` | Django settings, URLs, WSGI/ASGI |
| `config/artifacts.yaml` | Artifact root path, size limits, allowed kinds |
| `config/models.yaml` | Model provider configuration |
| `config/agents.yaml` | Agent definitions |
| `config/tools.yaml` | Tool registry |
| `config/permissions.yaml` | Permission policies |
| `config/workflows.yaml` | Workflow manifests |

Secrets belong in `.env` only — do not commit them.

## Testing

Tests cover routing, permissions, schemas, and boundary denials — not only happy paths.

```bash
uv run pytest
```

Run a subset:

```bash
uv run pytest tests/api/
uv run pytest tests/utils/
```

Frontend tests:

```bash
cd web
npm test
```

Test layout: `tests/{agents,api,utils/apps,utils/shared,web}/`. See [tests/README.md](tests/README.md) and the Testing section in [docs/platform.md](docs/platform.md).

## Repository layout

```text
.
├── agents/                 # coordinator, planner, memory, tools, providers
├── api/                    # DRF routes, serializers, middleware, schemas
├── config/                 # Django settings and runtime YAML
├── docs/
│   ├── platform.md         # architecture, routes, deployment
│   ├── api.md              # HTTP API contract
│   └── skills/             # agent instruction packs
├── utils/
│   ├── apps/{name}/        # backend, frontend, agent, shared per app
│   └── shared/             # auth, permissions, storage, search, embeddings
├── tests/
├── web/                    # React/Vite SPA
├── manage.py
└── pyproject.toml
```

Each app under `utils/apps/{name}/` follows:

```text
utils/apps/{app_name}/
├── backend/{api,models,services,tasks}/
├── frontend/{components,pages,hooks}/
├── agent/{tools.py,prompts.py}/
└── shared/
```

## Documentation

| Document | Contents |
| --- | --- |
| [docs/platform.md](docs/platform.md) | Architecture, frontend routes, deployment, testing |
| [docs/api.md](docs/api.md) | HTTP API contract between frontend and backend |
| [AGENTS.md](AGENTS.md) | Agent and layer-boundary instructions for contributors |
| [utils/apps/media_viewer/README.md](utils/apps/media_viewer/README.md) | Artifacts API, storage, and chat integration |
| [docs/skills/](docs/skills/) | Detailed conventions (Django, frontend, app modules, repo structure) |

## Development status

Mango Tree is under active development. What works today:

- React/Vite shell with themed UI and the `/chat` agent workspace
- Django health and media-viewer artifact APIs
- Local artifact upload, listing, streaming, thumbnails, and permission-scoped agent tools
- Test suite for API, artifact store, and agent tool boundaries

Planned or in progress:

- PostgreSQL + pgvector and Redis/Celery for production runtime
- Remaining app modules (projects, notes, jobs, calendar, and others)
- Full coordinator/planner wiring to production task and trace endpoints defined in `docs/api.md`

For architecture decisions and migration notes, see [docs/platform.md](docs/platform.md).
