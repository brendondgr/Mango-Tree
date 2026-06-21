---
name: app-modules
description: Use this skill when creating, migrating, or enforcing the standard layout for Mango Tree apps under utils/apps/, including backend services, frontend fragments, agent tools, and Flask migration.
---

# Mango Tree App Modules Skill

Each domain app lives under `utils/apps/{app_name}/` with a consistent internal layout. Apps are the unit of business logic, API behavior, UI fragments, and agent tool registration.

## Standard Layout

```text
utils/apps/{app_name}/
|-- backend/
|   |-- api/
|   |-- models/
|   |-- services/
|   `-- tasks/
|-- frontend/
|   |-- components/
|   |-- pages/
|   `-- hooks/
|-- agent/
|   |-- tools.py
|   `-- prompts.py
`-- shared/
```

## Code Placement Rules

- Business logic → `backend/services/` or `shared/`.
- Data models → `backend/models/`.
- DRF views → `backend/api/` (registered through `utils/api/routes/`).
- Celery tasks → `backend/tasks/`.
- Agent tools → `agent/tools.py` (call services, never duplicate logic).
- App UI fragments → `frontend/` (imported by `web/` shell).
- No business logic in `web/src/services/` beyond API client calls.

## Frontend Integration (web/ shell)

App UI in `utils/apps/{name}/frontend/` is imported by the `web/` SPA but lives
**outside** `web/`. Three wiring steps are mandatory or the module silently
renders wrong:

1. **Path alias** — add `@{name}` to both `web/vite.config.ts`
   (`resolve.alias`) and `web/tsconfig.json` (`compilerOptions.paths`), pointing
   at `../utils/apps/{name}/frontend`.
2. **Tailwind content source** — register the frontend in
   `web/src/styles/globals.css` with
   `@source "../../../utils/apps/{name}/frontend";`. Tailwind v4 auto-detects
   classes from the Vite root (`web/`) only; without this every utility class
   used solely in the module is dropped at build time and the UI loads unstyled
   (collapsed grids, no surfaces). Theme tokens still resolve, so the failure
   looks like "the CSS half-applied" rather than an obvious error.
3. **Scoped CSS naming** — prefix all app-owned CSS classes with the app name
   (`.{name}-card`, `.{name}-glass`) and wrap the root element in `.{name}-app`.
   Build the visual identity on theme tokens (`hsl(var(--primary))`, `--card`,
   category tokens), never raw hex, so it tracks the theme chosen in Settings.

## Agent Tool Registration

Tools in `agent/tools.py` must:

1. Call the same service functions used by DRF views.
2. Accept scoped inputs matching app schemas.
3. Return structured outputs for coordinator validation.
4. Respect permissions enforced by `utils/shared/permissions/`.

## API ↔ Agent Parity

If the UI can perform an action through the API, agents should reach the same outcome through registered tools. If an action is agent-only, document why in the app's README.

## Flask Migration Checklist

When migrating a Flask app into `utils/apps/{name}/`:

**Keep:**
- data models
- business rules
- services
- background jobs
- utilities
- API logic

**Remove:**
- templates tied to the old UI
- static frontend files
- page-specific frontend routing
- duplicated client-side logic

**Reorganize into:**
- `backend/models/`, `backend/services/`, `backend/api/`, `backend/tasks/`
- `frontend/components/`, `frontend/pages/`, `frontend/hooks/`
- `agent/tools.py`, `agent/prompts.py`
- `shared/` for domain logic used by both API and agent layers

## Registered Apps

- projects
- notes
- jobs
- calendar
- recipes
- imdbspy
- exercise (implemented — workouts/routines/equipment/history + Strava import)
- timekeeper
- media_viewer (implemented)

Each app directory includes a README describing its subfolder responsibilities.

## Structured Output for App Work

When planning or implementing app changes, specify:

1. Layer affected (`utils/apps/{name}/backend`, `frontend`, `agent`, or `shared`).
2. Service changes.
3. API/schema changes.
4. Agent tool changes (if any).
5. Test plan including permission denial cases.
6. Migration notes (Flask → app module, if applicable).
