# Mango Platform

Mango Tree is a local-first, single-owner agent platform. A React SPA and a
LangGraph agent loop both reach the same Django app services — the SPA through
DRF endpoints, the agent through registered tools. What the agent may touch is
decided by which tool groups the session has enabled.

This document describes what exists. Anything not built is labelled as such.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7, TanStack Router/Query, Zustand, Tailwind v4, shadcn/ui, Framer Motion |
| API | Django 5.2 + Django REST Framework |
| Agents | LangGraph (one graph, in `utils/agents/coordinator/`) |
| Database | SQLite — one `default` connection plus one per SQLite-backed app |
| Models | Any OpenAI-compatible HTTP endpoint (default `http://localhost:9090/v1`) |
| Storage | Local filesystem under `data/` |
| Search | SearXNG (optional, for the `search_web` tool) |
| Python tooling | `uv`, Python 3.13+ |

Not present, despite what older docs claimed: PostgreSQL, pgvector, Redis,
Celery, Uvicorn, S3, and llama-cpp bindings. None are dependencies, and none are
configured. `backend/tasks/` modules exist in a few apps but no broker runs them.

## Repository Layout

```text
.
├── config/                 # Django project (settings, urls, asgi, wsgi) + runtime YAML
├── data/                   # gitignored runtime state: artifacts, per-app SQLite, caches
├── docs/
│   ├── platform.md         # this file
│   ├── api.md              # HTTP API contract
│   ├── tool-groups.md      # the agent tool-group model
│   ├── skills/             # agent instruction packs (symlinked into .cursor/, .claude/, .codex/)
│   └── misc/               # brand token references behind the theme system
├── web/                    # React/Vite SPA shell
├── NewApps/                # gitignored drop-zone for apps awaiting migration
├── utils/
│   ├── agents/             # coordinator loop, tools, providers, schemas, skills
│   ├── api/                # DRF route modules
│   ├── apps/{name}/        # backend, frontend, agent, shared per app
│   ├── shared/             # auth, search, llm, events (+ empty permissions/storage/embeddings)
│   ├── scripts/            # dev + link-skills scripts
│   └── tests/              # pytest suite
├── manage.py
├── run.py                  # starts Django and Vite together
└── pyproject.toml
```

## Architecture

```text
User → web/ ─────────────────────────→ utils/api/routes/ → utils/apps/{app}/backend/services/
User → utils/agents/coordinator/graph → utils/agents/tools/ → utils/apps/{app}/agent/tools.py → same services
```

| Layer | Path | Role |
| --- | --- | --- |
| Frontend | `web/` | SPA shell and workspace; API clients only |
| API | `utils/api/` | DRF route modules, one per app |
| Agents | `utils/agents/` | The agent loop, tool registry, and LLM client |
| Apps | `utils/apps/{name}/` | Domain services, UI fragments, agent tools |
| Shared | `utils/shared/` | Auth, search, LLM config, artifact traces |

There is no planner and no specialist workflow. `utils/agents/coordinator/graph.py`
is a four-node LangGraph loop — `reason → act → observe → respond` — that
iterates up to six steps per turn. `utils/agents/planner/` and
`utils/agents/memory/` are empty placeholders.

Access control is real but narrower than older docs implied. The enforced
boundaries are the DRF `IsAuthenticated` default, the tool-group gate, and
per-tool `confirm: true` flags on irreversible actions.
`config/permissions.yaml` declares filesystem and network scopes but is read
only by tests; see `utils/shared/permissions/README.md`.

## Data Flow

**UI:** `web/src/services/` → `utils/api/routes/` → app services → SQLite or
`data/` files → TanStack Query → React.

**Agents:** `POST /api/agent/{session_id}/agent_turn/` → coordinator graph →
`utils/agents/tools/registry.py` (group gate) → `utils/apps/{app}/agent/tools.py`
→ the same app services. Turn progress streams back as SSE and is not persisted.

## Apps

Eight apps are implemented: **mailbox**, **calendar**, **exercise**,
**recipes**, **imdbspy**, **timekeeper**, **projectmanager**, and
**media_viewer**. Each has services, DRF routes under `/api/{app}/`, agent tools
in `config/tools.yaml`, and a workspace tab.

`jobs/`, `notes/`, and `projects/` are empty placeholder directories.

See `utils/apps/README.md` for tool counts, stores, and per-app layout
deviations, and the per-app READMEs for detail.

### App Standard

```text
utils/apps/{app_name}/
├── backend/{api,models,services,tasks}/
├── frontend/{components,pages,hooks}/
├── agent/{tools.py,prompts.py}
└── shared/
```

`models/` is absent from the three file-store apps (calendar, mailbox,
media_viewer); `tasks/` exists in only four.

**Code placement:** business logic in `backend/services/` or `shared/`; agent
tools call services rather than re-implementing them; app UI in
`utils/apps/{app}/frontend/`; nothing beyond API clients in `web/src/services/`.

## Frontend

React/Vite SPA with eight swappable shadcn/Tailwind themes across four families
(mango, blue, fsu, pulse), selected by `data-theme` on `<html>`.

### Routes (TanStack Router)

| Route | Renders |
| --- | --- |
| `/` | Redirect to `/chat` |
| `/login` | `LoginPage` — `/api/auth/login\|csrf/` |
| `/signup` | `SignupPage` — `/api/auth/signup\|registration-status/` |
| `/onboarding` | `OnboardingPage` — `/api/auth/preferences/` |
| `/chat` | `ChatPage` — the entire application |

That is the whole route tree. Apps are **not** routes; they are tabs inside
`/chat`. Settings, security, and app enablement are panels within the workspace,
not separate routes.

`/chat` and `/onboarding` are gated by `AuthGate`: unauthenticated visitors go
to `/login`, and a signed-in owner who has not finished onboarding goes to
`/onboarding` first.

### Component Map

| Area | Path |
| --- | --- |
| Router, providers, AuthGate, layouts, stores | `web/src/app/` |
| UI primitives (shadcn) and markdown rendering | `web/src/components/` |
| Features: agent turn runner, chat, workspace | `web/src/features/` |
| Pages: auth, chat, onboarding | `web/src/pages/` |
| API clients, types, hooks, theme, styles | `web/src/{services,types,hooks,lib,styles}/` |
| App UI fragments | `utils/apps/{app}/frontend/`, via Vite aliases |
| Apps registry | `web/src/features/workspace/apps/appRegistry.tsx` |

### `/chat` workspace layout

```text
┌────┬───────────────────────────┬─────────────────────────────────────────────┐
│Nav │  Left sidebar (resizable) │  Right workspace (main column)              │
│rail│                           │                                             │
│ 💬 │  ChatWindow               │  WorkspaceHeader (Apps home + app tabs)     │
│ 📨 │                           │  WorkspaceMainBody: Apps overview, an app,  │
│ 🏋 │                           │  or an ephemeral artifact viewer            │
│ 📁 │                           │                                             │
└────┴───────────────────────────┴─────────────────────────────────────────────┘
```

The nav rail (~48px) has a Chat button plus one quick-launch icon per registered
app. The left sidebar stays on chat; apps open as tabs on the right.

### Workspace tabs

`appRegistry.tsx` is the single source of truth — adding an entry wires the app
into the launcher, header tabs, nav-rail icon, and main-body routing at once.

| Tab type | Behavior |
| --- | --- |
| Apps home | Pinned leftmost, never closeable; shows the launcher grid |
| App tab | Opened from a launcher card or nav-rail icon; closeable |
| Ephemeral | Opened when an artifact is selected; italic label; shows the viewer |

Open tabs are not persisted across reloads — Apps home is always the landing
surface.

## Local runtime data

Everything under `data/` is gitignored and created on first use.

```text
data/
├── artifacts/{manifest.json,storage/,thumbnails/,events.jsonl}
├── calendar/{calendar.json,schedules/,instructions.md}
├── mailbox/{accounts.json,secrets.json,cache/}
├── exercise/workouttracker.db
├── projectmanager/projectmanager.db
├── imdbspy/{imdbtracker.db,media/}
├── timekeeper/timekeeper.db
└── recipes/recipes.db
```

Three storage patterns are in play:

- **Legacy SQLite, bound read/write.** exercise, projectmanager, and timekeeper
  bind `managed = False` models to a database an older standalone app created.
  The schema is never migrated. Override with `MANGO_EXERCISE_DB`,
  `MANGO_PROJECTMANAGER_DB`, `MANGO_TIMEKEEPER_DB`.
- **Own SQLite.** imdbspy uses Django-managed models and real migrations
  (`migrate --database=imdbspy`, override `MANGO_IMDBSPY_DB`). recipes owns its
  schema in `backend/services/store.py` and seeds a sample dataset on first run
  with no committed database (`MANGO_RECIPES_DB`).
- **Files.** media_viewer, calendar, and mailbox have no models at all. calendar
  seeds from a committed copy in `backend/seed/` on first run. mailbox writes
  `secrets.json` with `0600`. Neither is in `INSTALLED_APPS`; they are wired by
  URL include alone.

Artifact defaults come from `config/artifacts.yaml`; override the root with
`MANGO_ARTIFACTS_ROOT`.

## Authentication & Security

The platform is **single-owner and gated**, so it is safe to expose publicly.
The first visitor creates the owner account via `/signup`; registration then
closes and further signups return `403`. Auth is a Django session in an
**httpOnly** cookie, and DRF defaults every endpoint to `IsAuthenticated` with
`SessionAuthentication` — the whole API is closed unless signed in. Only
`/api/health/` and the public `/api/auth/` routes (login, signup, csrf,
registration-status) opt out. CSRF is enforced on state-changing requests; the
SPA echoes the `csrftoken` cookie in the `X-CSRFToken` header.

Repeated failed logins from an IP are **locked out** (`429`) after a threshold
within a rolling window, tunable via `MANGO_AUTH_*`. Every attempt lands in an
append-only log surfaced under Settings → Security, where the owner can review
attempts and clear a lockout. Per-owner preferences (`enabled_apps`,
`onboarding_completed`) drive onboarding and which workspace apps appear; only
the media viewer ("Artifacts") is enabled by default.

Auth lives in `utils/shared/auth/` (Django app label `mango_auth`, tables on the
`default` database). Production sets `DJANGO_ALLOWED_HOSTS` and
`DJANGO_CSRF_TRUSTED_ORIGINS`; behind a TLS proxy set
`DJANGO_BEHIND_TLS_PROXY=true`.

**The cookie trap.** Cookies are marked `Secure` whenever `DJANGO_DEBUG` is off.
A `Secure` cookie is only sent over https, so a `DEBUG=false` box browsed over
plain `http://` drops the session and CSRF cookies — login appears to succeed,
the session never sticks, and every subsequent request 403s. For that case set
`DJANGO_COOKIE_SECURE=false`. Leave it unset in production.

## Running

```bash
uv sync --extra dev
cp .env.example .env
cd web && npm install && cd ..
uv run manage.py migrate
uv run manage.py migrate --database=imdbspy
python run.py
```

`run.py` starts Django on **32553** and Vite on **5173** together. Open
`http://localhost:5173`. Django serves `/api` only and 404s at its own root.

To run them separately:

```bash
uv run manage.py runserver 32553
```

```bash
cd web && npm run dev
```

An OpenAI-compatible LLM server on port **9090** is required for chat; a SearXNG
instance on **8080** is optional and only needed for `search_web`.

| Service | Default |
| --- | --- |
| Vite dev server | localhost:5173 |
| Django / DRF | localhost:32553 |
| LLM (OpenAI-compatible) | localhost:9090 |
| SearXNG (optional) | localhost:8080 |

Configuration lives in `config/` (Django settings plus the artifacts, models,
permissions, search, and tools YAML). Secrets go in `.env` only.

## Testing

```bash
uv run pytest
```

```bash
cd web && npm test
```

Backend tests live in `utils/tests/{agents,api,config,utils/apps,utils/shared}/`
and are configured in `pyproject.toml`. Frontend tests sit beside their source
as `*.test.ts(x)` and run under Vitest.

Core rules:

- Include denial cases, not only success flows.
- A tool in a disabled group must be refused at execution, not merely hidden
  from the schema list.
- Unauthenticated requests must be rejected.
- Irreversible agent tools must refuse without `confirm: true`.
- DRF views and agent tools must enforce the same rules for the same operation,
  and must call the same services.
- Mock the LLM and any network egress unless that is what is under test.

## Skills

Detailed conventions live in `docs/skills/`, symlinked into `.cursor/skills/`,
`.claude/skills/`, and `.codex/skills/`.

- **global** — always-on step-and-commit workflow for every session that edits files
- **repo-structure**, **django-backend**, **app-modules**, **app-migration**,
  **website-architecture**, **ui-frontend**, **plan** — domain guidance

On Windows after clone, run `./utils/scripts/link-skills.ps1` if the skill links
appear as plain text files; `./utils/scripts/link-skills.sh` on macOS/Linux.
