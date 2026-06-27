---
name: app-migration
description: >-
  Use this skill whenever you need to migrate an existing standalone application
  (Django, Flask, FastAPI, Express/Node, or any other framework) into a Mango Tree
  app module under utils/apps/{name}/. Trigger it for any request to "port", "bring
  in", "absorb", "fold in", "rebuild as a tab", "import the backend of", or
  "restructure" an old app, even when the user does not name a framework. Covers
  diagnosing an unknown source app, preserving its existing database and data
  structures, splitting its code into the backend/services/agent/shared layers,
  exposing its capability as both a DRF API and registered agent tools, and wiring
  its UI as a workspace tab. This is the authoritative procedure; do not improvise a
  migration without following it.
---

# Mango Tree App Migration Skill

This skill turns an arbitrary legacy application into a Mango Tree app module that
behaves like `media_viewer` (the reference implementation): a single body of domain
logic in `backend/services/`, reachable identically through a DRF API and through
registered agent tools, with permissions enforced in code and the original data
left intact.

It is **framework-agnostic on the way in** (the source can be Django, Flask,
FastAPI, Express, or something else) and **opinionated on the way out** (the target
is always the standard layout in `docs/skills/app-modules/SKILL.md`).

**Where the source lands.** Raw standalone apps are dropped into `NewApps/{SourceName}/`
at the repo root — the staging drop-zone for apps awaiting migration. `NewApps/` is not
part of the running platform; nothing imports from it. Diagnose and migrate the source
out of `NewApps/` into `utils/apps/{name}/`, then remove the staging copy once the
migration is verified.

Read this file end to end before touching the source app. Then read the reference
files as each stage calls for them:

- `frameworks/django.md`, `frameworks/flask.md`, `frameworks/fastapi.md`, `frameworks/express.md`
  — how to locate and extract each artifact from a given source framework.
- `database-preservation.md` — how to keep the existing schema and data unchanged.
- `templates.md` — the two structured documents you must emit (Diagnosis Report and
  Migration Plan) plus the per-app verification checklist.

## Core invariant

> One body of domain logic. Two callers. Same data.

Everything below exists to enforce that sentence. If at the end the API and the agent
tools call different code, or the data shape changed without an explicit data
migration, the migration is wrong regardless of whether tests pass.

## Non-negotiable rules (inherited from the platform)

These come from `docs/platform.md`, `docs/skills/django-backend/SKILL.md`,
`docs/skills/app-modules/SKILL.md`, and `docs/skills/global/SKILL.md`. The migration
must not violate them:

1. **Service-first.** Business logic lives only in `utils/apps/{name}/backend/services/`
   or `utils/apps/{name}/shared/`. DRF views and agent tools are thin and call services.
2. **API ↔ agent parity.** Any capability the UI can reach through the API must be
   reachable by an agent through a registered tool that calls the *same* service
   function. Agent-only capabilities must be justified in the app README.
3. **Permissions in code, not prompts.** Filesystem, network, dataset, and namespace
   scopes are enforced through `utils/shared/permissions/` and the tool's
   `ExecutionContext`, declared in `config/permissions.yaml`.
4. **Stable error codes.** Services raise typed errors that map to
   `validation_error`, `permission_denied`, `not_found`, `conflict`, `internal_error`.
5. **Document before frontend.** Endpoints appear in `docs/api.md` before any
   `web/` code assumes they exist.
6. **Step-and-commit.** Each stage below is one or more logical units: implement →
   validate → commit. Never commit broken work. Never add AI/tool attribution to
   commit messages.
7. **Tests include denial cases.** Not just happy paths — path traversal, missing
   confirmation, out-of-scope access, oversize input, unauthorized operations.
8. **`uv` for Python.** All Python commands run through `uv run ...`.

## The pipeline

Ten stages, in order. Stages 0–1 are read-only analysis and produce the two planning
documents. Stages 2–9 are implementation; each ends in validation and a commit.

```text
0  Intake & Diagnosis      (read-only)  -> Diagnosis Report
1  Target Mapping          (read-only)  -> Migration Plan
2  Scaffold the module     commit
3  Preserve the database   commit
4  Port domain logic       commit(s)
5  Expose the DRF API       commit
6  Build the agent framework  commit
7  Wire the frontend tab    commit
8  Test & verify            commit
9  Decommission old surface commit
```

Do not skip ahead. The two documents from stages 0–1 are the contract the rest of the
work is checked against; if the user wants only a plan, stop after stage 1 and hand
them the Migration Plan.

---

### Stage 0 — Intake & Diagnosis (read-only)

Goal: understand the source app well enough to map it, without changing anything.

1. **Detect the framework.** Look for signature files before reading code:
   `manage.py` + `settings.py` → Django; `app = Flask(__name__)` or
   `flask run` → Flask; `FastAPI()` + `uvicorn`/`APIRouter` → FastAPI;
   `package.json` with `express` → Express/Node; otherwise record "other" and infer
   from the entrypoint. Then open the matching `frameworks/{name}.md` reference.

2. **Inventory by responsibility, not by file.** Using the framework reference,
   locate and list every instance of:
   - **Data models / schema** — ORM models, table definitions, migrations, raw DDL.
   - **Persistence config** — the database engine, connection string, and where it
     is configured. Record the live DB so stage 3 can preserve it.
   - **Business rules / services** — the functions that actually do the work, wherever
     they currently sit (often inside views/route handlers — note that).
   - **Background jobs** — cron, Celery, RQ, APScheduler, BullMQ, etc.
   - **External I/O** — outbound HTTP, third-party SDKs, filesystem reads/writes,
     message queues. These become permission scopes in stage 6.
   - **HTTP surface** — every route, its method, inputs, and outputs.
   - **Utilities** — shared helpers, validators, serialization.
   - **UI / templates / static** — read it as a *behavioral reference*: capture the
     user-facing flows, screens, and interactions (what the app lets a user do and in
     what order) so the rebuilt tab can reproduce that behavior. The UI **code itself
     is discarded, not ported** — only the understanding of how it worked carries over.
   - **Auth** — how the app currently identifies and authorizes callers.

3. **Identify entanglement.** Flag any place where business logic is fused with the
   web framework (e.g. a Flask route that both validates a request and writes to the
   DB inline). Each such site becomes a "extract service" task in the plan.

4. **Emit the Diagnosis Report** using the template in `templates.md`. This is a
   read-only deliverable. Do not write any target code yet.

> If the source app is large or unfamiliar, prefer reading the framework reference
> and the source's own README/migrations first, then skimming entrypoints, rather
> than reading every file. The inventory must be complete in *responsibilities*, not
> exhaustive in *lines*.

---

### Stage 1 — Target Mapping (read-only)

Goal: decide where every inventoried item lands, and in what order, before writing code.

1. **Choose the app name.** Lowercase, single token, matching the source's domain
   (e.g. `invoices`, not `flask_invoice_app`). Confirm it is not already a registered
   app that means something else.

2. **Map each item to a destination** using this table:

   | Source item | Mango Tree destination |
   | --- | --- |
   | Data models / schema | `utils/apps/{name}/backend/models/` |
   | Business rules / services | `utils/apps/{name}/backend/services/` |
   | Cross-layer domain helpers | `utils/apps/{name}/shared/` |
   | Background jobs | `utils/apps/{name}/backend/tasks/` (Celery) |
   | HTTP routes (the *behavior*) | `utils/apps/{name}/backend/api/` (DRF views) → `utils/api/routes/{name}.py` |
   | Each agent-exposable capability | `utils/apps/{name}/agent/tools.py` + `config/tools.yaml` |
   | External I/O scopes | `config/permissions.yaml` |
   | DTOs / schemas | `utils/apps/{name}/shared/schemas.py` |
   | Typed errors | `utils/apps/{name}/shared/errors.py` |
   | UI (templates/static/client routing) | **discard**; rebuild as `frontend/` fragments + a tab |

3. **Decide the database strategy.** Read `database-preservation.md` and pick one of
   its three strategies (bind-to-existing, inspect-and-adopt, or migrate-with-data).
   Record the choice and why. This is the single most important decision for "keep the
   data the same," so make it explicit.

4. **Decide the parity surface, and confirm the agent surface is relevant.** For each
   capability, decide whether it is exposed via API, via agent tool, or both. Default
   to both, but treat the agent-tool list as a deliberate choice, not a dump: list the
   exact capabilities the agent should be able to call and why each one is worth
   exposing, and drop any that the agent has no realistic reason to use. The Migration
   Plan presents this list for confirmation **before** stage 6 builds the tools — the
   agent's API surface is approved as relevant, not assumed. Note any API-only or
   agent-only exceptions with a one-line justification.

5. **Emit the Migration Plan** using the template in `templates.md`. It follows the
   shape required by `docs/skills/plan/SKILL.md` (summary, layers affected, steps by
   layer, API/schema changes, agent tool changes, test plan with denial cases,
   migration notes, assumptions) and sequences stages 2–9 into commit-sized steps.

Stop here if the user only asked for a plan.

---

### Stage 2 — Scaffold the module (commit)

Create the standard skeleton and register the app so the rest can hang off it.

1. Create the directory tree exactly as in `docs/skills/app-modules/SKILL.md`:

   ```text
   utils/apps/{name}/
   |-- README.md
   |-- backend/{api,models,services,tasks}/
   |-- frontend/{components,pages,hooks}/
   |-- agent/{tools.py,prompts.py}
   `-- shared/{schemas.py,errors.py,constants.py}
   ```

2. Write the README from the per-app template (purpose, layout, endpoints, tools) —
   model it on `utils/apps/media_viewer/README.md`.

3. Register `utils.apps.{name}.backend` as a Django app in `config/django/settings`.

4. Reserve the route module `utils/api/routes/{name}.py` (can be empty/stub) and reserve the
   endpoint block in `docs/api.md` under the app's heading. No real endpoints yet.

**Validate:** `uv run manage.py check` passes; the app imports.
**Commit:** `feat({name}): scaffold app module and register Django app`.

---

### Stage 3 — Preserve the database (commit)

This is the "keep all the data structures and databases the same" requirement. Do not
proceed until the chosen strategy from `database-preservation.md` is implemented and a
round-trip read of existing rows works.

The short version of the three strategies (full detail in `database-preservation.md`):

- **Bind to existing (no data move):** define Django models whose `Meta.db_table`
  and column names match the legacy tables; start with `managed = False` so Django
  reads/writes the existing tables without trying to recreate them. Best when the old
  DB stays in place.
- **Inspect and adopt:** run `uv run manage.py inspectdb` against the legacy database
  to generate models from the live schema, then curate them into
  `backend/models/`. Decide per table whether Django manages it going forward.
- **Migrate with data:** when consolidating into the platform's PostgreSQL/pgvector
  instance, recreate the schema via Django migrations, then move the rows with a data
  migration or an ETL script. Verify row counts and checksums before and after.

**Validate:** a read-only script lists existing records through the new models and the
counts match the legacy source.
**Commit:** `feat({name}): bind models to existing schema` (wording depends on strategy).

---

### Stage 4 — Port domain logic into services (commit(s))

Move the *behavior* into `backend/services/` and `shared/`, untangling it from the old
web framework as you go.

1. For every entangled site flagged in stage 0, extract the logic into a service
   function with explicit inputs and a typed return. The old route handler's body
   becomes a call to that function.
2. Put domain helpers used by both the API and the agent in `shared/`.
3. Define DTOs in `shared/schemas.py` (dataclasses or Pydantic, matching media_viewer)
   and typed errors in `shared/errors.py` that carry a stable `code`, `message`, and
   `details`, mapping to the five platform error codes.
4. Move background jobs into `backend/tasks/` as Celery tasks whose bodies only
   delegate to services.
5. Do **not** duplicate logic between layers. A service is the single source of truth
   for one operation.

**Validate:** `uv run pytest utils/tests/utils/apps/{name}/` — service tests cover the
ported behavior including at least one denial/validation case per service.
**Commit:** one commit per cohesive service group (e.g. `feat({name}): port invoice
calculation service`).

---

### Stage 5 — Expose the DRF API (commit)

Wrap services in a thin HTTP layer.

1. Write serializers and DRF views in `backend/api/` that validate input, call a
   service, and serialize the result. No domain logic in views.
2. Register routes in `utils/api/routes/{name}.py` and include them in the root URLconf.
3. Map service errors to stable JSON error codes with a consistent envelope.
4. Use platform defaults (pagination page size 25, etc.).
5. Fill in the reserved `docs/api.md` block with the real endpoints, methods, inputs,
   and response shapes — this is now the contract.

**Validate:** `uv run pytest utils/tests/api/test_{name}.py` plus a manual `curl` round-trip
for each endpoint; errors return stable codes.
**Commit:** `feat({name}): add DRF API over services`.

---

### Stage 6 — Build the agent framework (commit)

This is the "structured agentic framework for API calls or tools" you want for each
app. Model it on `utils/apps/media_viewer/agent/tools.py`.

1. For each capability that should be agent-reachable, write a tool function in
   `agent/tools.py` that:
   - Accepts keyword-only, schema-typed inputs.
   - Calls the **same service** the matching DRF view calls (parity).
   - Wraps the call in the `ToolResult` pattern (success → structured `data`;
     typed error → `{ "error": { code, message, details } }`) so the coordinator can
     validate the output.
   - Accepts an injectable service/store handle so the tool is unit-testable without
     real I/O (see how media_viewer injects `store`).
   - Requires explicit confirmation for destructive operations (e.g. a `confirm: true`
     argument on delete), matching the UI's two-step semantics.
2. Write `agent/prompts.py` with a short fragment telling the planner when to use each
   tool, how to reference returned IDs, and which operations need user confirmation.
3. Register every tool in `config/tools.yaml` (app, module, function, description),
   mirroring the media_viewer entries.
4. Declare permission scopes in `config/permissions.yaml`: filesystem roots, allowed
   network schemes/hosts, dataset/namespace access — whatever the stage-0 inventory of
   external I/O turned up. Deny everything outside the app's legitimate scope
   (path traversal, `.env`, `config/`, other apps' data).
5. Emit trace events on state-changing tool calls via `utils/shared/events/`.

**Validate:** `uv run pytest utils/tests/utils/apps/{name}/test_agent_tools.py` — assert
tools produce structured output, call the service layer (mock the service, not the
I/O), and **deny** out-of-scope access and missing-confirmation deletes.
**Commit:** `feat({name}): add agent tools, registration, and permission scopes`.

> Parity self-check: list the registered tools next to the API endpoints. Every
> non-exceptional capability should appear in both columns, backed by the same service
> function. If a row is missing on one side without a documented reason, fix it now.

---

### Stage 7 — Wire the frontend tab (commit)

The old frontend was studied in stage 0 and is **fully discarded**, not ported. Rebuild
the surface from scratch as a tab in the shell, reproducing the behaviors captured in
stage 0 but designed entirely per the platform's current UI plans — the authority for
this rebuild is `docs/skills/website-architecture/SKILL.md` (routes, data flow,
frontend/backend contract) and `docs/skills/ui-frontend/SKILL.md` (components, theme,
layout, accessibility). Do not imitate the legacy app's look or markup.

1. Build UI fragments under `utils/apps/{name}/frontend/{components,pages,hooks}/`
   using the platform stack (React/Vite, TanStack Query, shadcn/Tailwind) as specified
   by the two frontend skills above, with an API client in
   `web/src/services/{name}Client.ts` (request/response only, no logic). The app's
   top-level surface should be a single page component (e.g.
   `frontend/pages/{Name}Workspace.tsx`) that fills the workspace body.
2. Import the fragments into the shell via a Vite alias (e.g. `@{name}` →
   `utils/apps/{name}/frontend/`) in `web/vite.config.ts`, following how
   `@media-viewer` is wired.
3. **Register the app in the Apps menu.** Add one entry to `WORKSPACE_APPS` in
   `web/src/features/workspace/apps/appRegistry.tsx`:

   ```tsx
   import { {Name}Workspace } from "@{name}/pages/{Name}Workspace";
   // ...
   {
     id: "{name}",                 // stable id; the tab value is `app:{name}`
     label: "{Label}",             // tab + launcher label
     description: "One line describing what the app does.",
     icon: SomeLucideIcon,
     Component: {Name}Workspace,   // rendered in the workspace body
   }
   ```

   That single entry auto-wires the app everywhere — the Apps overview launcher
   (`AppsOverview`), the header tab strip with open/close and active state
   (`WorkspaceHeader`), the left nav-rail quick-launch icon (`ChatNavRail`), and
   main-body routing (`WorkspaceMainBody`). Do **not** hand-wire tabs into those
   components; they read the registry. App-specific view state (sub-tabs, density,
   etc.) still lives in `workspaceStore`, but tab open/close is generic
   (`openAppTab(id)` / `closeAppTab(id)`).

   A pinned TanStack Router route (like `/notes`, `/projects`) is only for a
   standalone surface that must be linkable by URL; the default for a `/chat`-scoped
   app is the registry tab above.
4. Do not invent endpoints; the frontend may only call what `docs/api.md` lists.

**Validate:** `cd web && npm run build` succeeds; the app appears as a card in the
Apps overview, opens in a tab, closes back to the overview, and reads through the
API client.
**Commit:** `feat({name}): add frontend fragments and workspace tab`.

> If the user's priority is backends + the agentic framework (often the case for this
> migration work), this stage can be deferred to a later milestone — but the API and
> agent tools from stages 5–6 must already be complete, since the tab is just another
> consumer of them.

---

### Stage 8 — Test & verify (commit)

Close the loop with the full matrix, weighted toward boundaries.

Required test groups (see `templates.md` for the checklist):
- **Service tests** — ported behavior, validation, typed errors.
- **API tests** — round-trips, pagination, stable error codes, auth/permission denials.
- **Agent tool tests** — structured output, service-layer usage, scope and
  confirmation **denials**.
- **Database tests** — existing rows read back unchanged; if migrated, counts and
  checksums match.

**Validate:** `uv run pytest utils/tests/utils/apps/{name}/ utils/tests/api/test_{name}.py`,
`uv run manage.py test`, then the full suite before merge: `uv run pytest` and
`cd web && npm run build`.
**Commit:** `test({name}): cover services, API, tools, and permission denials`.

---

### Stage 9 — Decommission the old surface (commit)

Only after the replacement is proven.

1. Remove old templates, static frontend files, page-specific routing, and duplicated
   client-side logic from the imported source.
2. Keep models, business rules, services, jobs, utilities, and API logic — those now
   live in the module.
3. Update `docs/platform.md` (register `{name}` in the app list, note its data store)
   and add `{name}` to the registered-apps lists in `docs/skills/app-modules/SKILL.md`
   and `utils/apps/README.md`.

**Validate:** full suite green; no references to removed files remain.
**Commit:** `chore({name}): remove legacy UI and finalize app registration`.

---

## Per-app definition of done

A migration is complete when all of these hold (full checklist in `templates.md`):

- The app directory matches the standard layout and is a registered Django app.
- Existing data reads back unchanged through the new models (or migrated with verified
  counts/checksums).
- All business logic lives in `services/`/`shared/`; views and tools are thin.
- Every non-exceptional capability is reachable by both API and agent tool, backed by
  the same service.
- Tools are registered in `config/tools.yaml` and scoped in `config/permissions.yaml`.
- Endpoints are documented in `docs/api.md`; the app README lists endpoints and tools.
- Tests cover success **and denial** cases across services, API, tools, and data.
- `uv run pytest` and `cd web && npm run build` pass.
- The old UI surface is removed and the app is registered in the platform docs.

## Doing several apps

Migrate **one app at a time** end to end (stages 0–9) before starting the next, per the
platform build sequence. Shared infrastructure discovered during one migration
(a reusable auth shim, a storage adapter) belongs in `utils/shared/`, not copied into
each app. Reuse the Diagnosis Report and Migration Plan templates per app so each
migration produces the same paper trail.
