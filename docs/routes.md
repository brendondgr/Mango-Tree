# Routes

Routes are defined with TanStack Router in the target React/Vite frontend. The legacy Astro skeleton currently serves only `/`.

## Target Routes

| Route | Purpose | Auth | Data Source |
| --- | --- | --- | --- |
| `/` | Redirect to dashboard. | TBD | — |
| `/dashboard` | Main dashboard with stats and activity. | TBD | `/api/tasks/`, app summaries |
| `/chat` | AI chat workspace. | TBD | `/api/tasks/`, agent endpoints |
| `/projects` | Projects list and management. | TBD | `/api/projects/` |
| `/projects/:id` | Project detail view. | TBD | `/api/projects/{id}/` |
| `/notes` | Notes list and editor. | TBD | `/api/notes/` |
| `/notes/:id` | Note detail view. | TBD | `/api/notes/{id}/` |
| `/jobs` | Jobs list and status. | TBD | `/api/jobs/` |
| `/calendar` | Calendar view. | TBD | `/api/calendar/events/` |
| `/agents` | Agent definitions and status. | TBD | `/api/agents/` |
| `/workflows` | Workflow manifests and status. | TBD | `/api/workflows/` |
| `/tools` | Tool registry and capability bundles. | TBD | `/api/tools/` |
| `/memory` | Memory namespaces and datasets. | TBD | `/api/memory/` |
| `/traces/:taskId` | Task events, artifacts, and logs. | TBD | `/api/traces/{task_id}/` |
| `/settings` | Platform and app settings. | TBD | TBD |

## App Routes (Future)

When app modules are implemented, additional routes may be registered:

- `/recipes`, `/imdbspy`, `/exercise`, `/timekeeper`

App-specific pages may also live as imported fragments from `utils/apps/{app}/frontend/pages/`.

## Rules

- Route definitions belong in `web/src/app/router/`.
- Do not implement a route until its data source is documented in `docs/api-contract.md` or explicitly marked as static placeholder.
- Command palette (cmdk) should expose navigation to all registered routes.

## Legacy Note

The current Astro skeleton defines only `/` via `web/src/pages/index.astro`. Do not add Astro routes. New routes follow TanStack Router in the React/Vite scaffold.
