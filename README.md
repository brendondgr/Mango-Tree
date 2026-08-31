<p align="center">
  <img src="docs/assets/mango-color.svg" alt="Mango Tree logo" width="160" />
</p>

# Mango Tree

Mango Tree is a **local-first, single-owner agent platform**. A React workspace
and a LangGraph agent loop both reach the same Django services — the UI through
DRF endpoints, the agent through registered tools. What the agent can touch is
decided by which tool groups you switch on, enforced in code rather than asked
for in a prompt.

Everything runs on your machine. The per-app SQLite databases and all files
live under `data/`; the platform's own database — owner account, sessions,
security log, LLM providers — is `.django-test.sqlite3` at the repo root.
Models are your choice — a local OpenAI-compatible server, Ollama, or a hosted
provider — configured from the settings page rather than a config file.

<p align="center">
  <img src="docs/assets/workspace.png" width="820"
       alt="The Mango Tree workspace: the agent chat on the left, and the Apps tab on the right listing Mailbox, Exercise, Projects, Calendar, IMDbSpy, Recipes, Artifacts and Time Keeper as cards." />
</p>

**Status: active, single developer, built through 2026.** Everything below the
Architecture section works today. The planner and memory layers, a shared
permission engine, embeddings, object storage and a task queue are empty
placeholders, and this README says so where each comes up rather than implying
otherwise.

## Why it exists

A hosted assistant cannot touch your mail, your calendar or your workout
history unless you hand all of it to somebody else's server. A folder of
self-hosted apps has the opposite problem: the data is yours, and nothing can
reason across it. Mango Tree is the third option — the apps and the model both
run on your machine, and they reach the same code.

The consequence is the design decision the rest of the project follows from:
every capability is a service, and both the DRF endpoint the UI calls and the
tool the agent calls go through that same service. So the agent can do anything
you can do — which is exactly why what it may do is decided by which tool groups
you switch on, checked twice in code, and not by a sentence in a system prompt
asking it politely to stay out of your email.

## What's here

Eight apps live inside one chat workspace, each usable by you through its UI and
by the agent through its tools:

| App | What it does | Agent tools |
| --- | --- | --- |
| **Mailbox** | IMAP/SMTP accounts, folders, read, move, mark, delete, reply | 10 |
| **Calendar** | Weekly schedules mapped onto dates, merged with one-off events, themed PDF export | 12 |
| **Exercise** | Workouts, routines, equipment, history, Strava import | 15 |
| **Recipes** | Browse and filter, pantry matching, CRUD with an LLM recipe parser | 7 |
| **IMDbSpy** | Movie/TV tracker with IMDb scraping and weighted Fun/Grit/Comfort ratings | 6 |
| **Time Keeper** | 5-minute block tracking across categories, daily statistics | 5 |
| **Projects** | Projects, goals, deadlines, timeline | 4 |
| **Artifacts** | Upload, browse, and view images, video, PDF, markdown, LaTeX, text | 4 |

Plus six core tools (artifacts, skills inspection, chat context, web search)
that are always available.

**Tool groups.** All 63 app tools start **off**. You enable a group per session
from the composer, a slash command (`/enable mailbox`), or the chip that appears
when the agent is refused. The gate runs twice — a disabled group's tools are
never offered to the model, and are refused at execution if it calls one anyway.
See [docs/tool-groups.md](docs/tool-groups.md).

## What it looks like

Captured from a fresh install by
[`utils/scripts/capture_screenshots.py`](utils/scripts/capture_screenshots.py),
so they can be regenerated rather than going quietly stale.

| | |
| --- | --- |
| <img src="docs/assets/timekeeper.png" width="400" alt="The Time Keeper tab: a day painted across 288 five-minute blocks, colour-coded by category, with the agent chat still open beside it." /> | <img src="docs/assets/workspace-dark.png" width="400" alt="The same Apps tab in the Blue Dark theme — one of eight, all defining the same 57 tokens." /> |
| An app tab and the chat share the screen; the agent reaches the same services the tab does. | Eight themes, swapped at runtime. |

<p align="center">
  <img src="docs/assets/mobile.png" width="260"
       alt="The workspace at 390x844: the app cards stack in one column, with Chat, Apps and More in a bottom bar." />
</p>

<p align="center"><em>390×844. Mobile is a first-class target, not a
reflow — see <a href="docs/audit-report.md">docs/audit-report.md</a>.</em></p>

## Architecture

```text
You → web/ ─────────────────────────→ utils/api/routes/ → utils/apps/{app}/backend/services/
You → utils/agents/coordinator/graph → utils/agents/tools/ → utils/apps/{app}/agent/tools.py → same services
```

| Layer | Path | Rule |
| --- | --- | --- |
| Frontend | `web/` | React/Vite SPA. API clients only, no business logic |
| API | `utils/api/` | DRF surface. Thin views that call services |
| Agents | `utils/agents/` | The agent loop, tool registry, LLM client |
| Apps | `utils/apps/{name}/` | Domain services, UI fragments, agent tools |
| Shared | `utils/shared/` | Auth, search, the LLM provider layer |
| Config | `config/` | Django settings and runtime YAML |

The agent is one LangGraph graph in `utils/agents/coordinator/graph.py`:
`reason → act → observe → respond`, up to six steps per turn, streamed to the
browser as SSE. There is no separate planner and no specialist workflows —
`utils/agents/planner/` and `utils/agents/memory/` are empty placeholders.

Apps are **tabs inside `/chat`**, not routes. Adding an entry to
`web/src/features/workspace/apps/appRegistry.tsx` wires an app into the
launcher, tab strip, nav rail, and body routing at once.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 7, TanStack Router/Query, Zustand, Tailwind v4, shadcn/ui, Framer Motion |
| API | Django 5.2, Django REST Framework |
| Agents | LangGraph |
| Database | SQLite — one `default` connection plus one per SQLite-backed app |
| Models | OpenAI-compatible servers (vLLM, llama.cpp, LM Studio), Ollama, Anthropic, OpenAI, Gemini |
| Storage | Local filesystem under `data/` |
| Search | SearXNG (optional) |
| Tooling | [uv](https://docs.astral.sh/uv/), Python 3.13+, npm |

No PostgreSQL, Redis, Celery, or S3 — by design, not by omission.

## Setup

You need **git**, **[uv](https://docs.astral.sh/uv/)**, **Python 3.13** and
**Node/npm** already installed. Everything else is one command.

```bash
git clone git@github.com:brendondgr/Mango-Tree.git && cd Mango-Tree && ./scripts/bootstrap
```

`bootstrap` installs both dependency trees, copies `.env.example` to `.env` if
you have no `.env` yet, creates the gitignored `data/` tree, and builds the app
databases. It is idempotent — re-running it on a live install never overwrites
an existing database or your `.env`.

Edit `.env` if your model server is not at `http://localhost:9090/v1`. You can
also add providers, paste API keys and pick a model from **Settings → LLM**
once the app is running — nothing about the model backend has to be decided at
setup time.

<details>
<summary>The same steps by hand, and the Windows symlink fix</summary>

```bash
uv sync --extra dev
cp .env.example .env
uv run utils/scripts/init_data.py       # data/ dirs + the legacy app schemas
uv run manage.py migrate
uv run manage.py migrate --database=imdbspy
cd web && npm install && cd ..
```

`init_data.py` exists because `data/` is gitignored: SQLite creates a missing
database *file* but never a missing *directory*, so without it the imdbspy
migration cannot open its database. It also builds the empty schemas for the
three apps whose models bind `managed = False`, using the schema editor rather
than a migration — see the rule below about never migrating those.

On Windows, if the skill links under `.cursor/`, `.claude/`, or `.codex/` appear
as plain text files after cloning:

```powershell
./utils/scripts/link-skills.ps1
```

On macOS/Linux:

```bash
./utils/scripts/link-skills.sh
```

</details>

## Running

```bash
./scripts/server
```

That starts Django on **32553** and Vite on **5173** together. Open
<http://localhost:5173> — the first visit creates your owner account, after
which signup closes.

To run them separately:

```bash
uv run manage.py runserver 32553
```

```bash
cd web && npm run dev
```

Django serves `/api` only and returns 404 at its own root; browse the app
through Vite, which proxies `/api` to it.

| Service | URL | Required |
| --- | --- | --- |
| Vite dev server | `http://localhost:5173` | yes |
| Django / DRF | `http://localhost:32553` | yes |
| Model provider | `http://localhost:9090` by default | for chat — or any provider set in Settings → LLM |
| SearXNG | `http://localhost:8080` | for web search |

Health check: `GET http://localhost:32553/api/health/`.

## Security

Single-owner and gated, so it is safe to expose. The first visitor creates the
owner account and registration closes. Auth is a Django session in an httpOnly
cookie, `IsAuthenticated` is the DRF default across the entire API, and repeated
failed logins lock out an IP with every attempt written to an audit log you can
review under Settings → Security.

**One trap worth knowing.** Cookies are marked `Secure` whenever `DJANGO_DEBUG`
is off, and a `Secure` cookie is never sent over plain http. Running
`DEBUG=false` on an http host therefore drops the session — login appears to
work, then every request 403s. Set `DJANGO_COOKIE_SECURE=false` for that case,
and leave it unset behind TLS.

## Configuration

<details>
<summary>Every configuration file and what it decides</summary>

| Location | Purpose |
| --- | --- |
| `.env` | Default LLM endpoint and any provider API keys named by `config/models.yaml`; OAuth and Strava credentials; database path overrides |
| `config/django/settings.py` | Databases, DRF defaults, cookie and CSRF security |
| `config/artifacts.yaml` | Artifact root, size limits, allowed kinds |
| `config/models.yaml` | Declared LLM providers. Secrets are *named* here (`api_key_env`), never embedded; providers the owner adds in Settings → LLM live in the database instead |
| `config/tools.yaml` | Agent tool registry and tool groups |
| `config/permissions.yaml` | Declared filesystem and network scopes (verified by tests) |
| `config/search.yaml` | SearXNG endpoint and fetch limits |

Secrets belong in `.env` only.

</details>

## Testing

```bash
./scripts/test
```

`./scripts/test backend` and `./scripts/test frontend` run one half.

Backend tests live in `utils/tests/`, frontend tests beside their source as
`*.test.ts(x)`. Tests cover denial cases, not only happy paths: a disabled tool
group must be refused at execution, unauthenticated requests rejected, and
irreversible tools must refuse without `confirm: true`.

**What a fresh clone sees:** 570 passed, 62 skipped, nothing failed. The 62 are
marked `needs_legacy_data` — they assert against rows in the databases the
exercise, projectmanager and timekeeper apps were migrated from, and a clone has
those schemas but not the maintainer's rows. They run, and must pass, on an
install that has the data. Everything else — including every denial-case test —
runs anywhere.

## Repository layout

<details>
<summary>The tree, and the shape every app module follows</summary>

```text
.
├── config/            # Django settings, urls, and runtime YAML
├── data/              # gitignored runtime state: artifacts, per-app SQLite, caches
├── docs/              # platform.md, api.md, tool-groups.md, audits, and skills/
│   └── skills/        # conventions, symlinked into .claude/, .cursor/, .codex/
├── scripts/           # bootstrap, server, test — one entrypoint per verb
├── utils/
│   ├── agents/        # the agent loop, tools, providers
│   ├── api/routes/    # one URLconf module per app
│   ├── apps/{name}/   # backend, frontend, agent, shared per app
│   ├── scripts/       # init_data.py, the UI audit harness, skill-link fixers
│   ├── shared/        # auth, search, llm, events
│   └── tests/
├── web/               # React/Vite SPA shell
├── manage.py
├── run.py
└── pyproject.toml
```

Each app follows:

```text
utils/apps/{app_name}/
├── backend/{api,models,services,tasks}/
├── frontend/{components,pages,hooks}/
├── agent/{tools.py,prompts.py}
└── shared/
```

`models/` is absent from the three file-store apps. App UI lives with the app
and is imported into `web/` through Vite aliases.

</details>

## Contributing

[`CONTRIBUTING.md`](CONTRIBUTING.md) has the setup, the test baseline, and the
five rules that are not negotiable. The conventions themselves live in
`docs/skills/`, which is what the coding agents in this repo read too — start
with [docs/skills/global/SKILL.md](docs/skills/global/SKILL.md), which defines
the step-and-commit workflow.

Security issues go through [`SECURITY.md`](SECURITY.md), not a public issue.

## Documentation

| Document | Contents |
| --- | --- |
| [docs/platform.md](docs/platform.md) | Architecture, storage, security, running, testing |
| [docs/api.md](docs/api.md) | The full HTTP API contract |
| [docs/tool-groups.md](docs/tool-groups.md) | How agent tool gating works |
| [docs/skills/](docs/skills/) | Conventions for each layer |
| `utils/apps/README.md` | Every app, its tools, and its store |

Two audits are kept as records rather than as current instructions — they
describe the repository as it was on the day they were written:

| Record | What it measured |
| --- | --- |
| [docs/audit-report.md](docs/audit-report.md) | The rendered UI, and the overhaul that followed ([plan](docs/overhaul-plan.md)) |
| [docs/repo-audit.md](docs/repo-audit.md) | The repository itself: structure, doc truth, clean-clone runnability ([plan](docs/repo-restructure-plan.md)) |

## Status

Working today: the chat workspace with a streaming agent loop and gated tools,
single-owner auth with onboarding and a security log, eight app modules with
both UI and agent access, eight themes, and a test suite across the backend and
frontend.

Not built, and documented as such rather than implied: the planner and memory
layers (`utils/agents/planner/`, `utils/agents/memory/`), a shared permission
engine, embeddings and vector search, object storage, and any background task
queue. Each is an empty package with a README explaining what would go in it.

## Licence

[MIT](LICENSE). © 2026 brendondgr.
