# API Contract

No backend API is implemented yet. This document defines the contract boundary between the React/Vite frontend and the Django/DRF backend.

## Base URL

All endpoints are prefixed with `/api/` unless noted otherwise.

## Error Schema

All error responses use this structure:

```json
{
  "code": "permission_denied",
  "message": "Human-readable summary.",
  "details": {}
}
```

Stable error codes include: `validation_error`, `permission_denied`, `not_found`, `conflict`, `internal_error`.

## Platform Endpoint Groups

### Tasks

- `POST /api/tasks/` — create a task run.
- `GET /api/tasks/` — list task runs.
- `GET /api/tasks/{id}/` — inspect a task run.
- `POST /api/tasks/{id}/cancel/` — cancel a task run.

### Agents

- `GET /api/agents/` — list coordinator, planner, and specialist definitions.
- `GET /api/agents/{id}/` — inspect an agent definition.

### Workflows

- `GET /api/workflows/` — list workflow manifests.
- `GET /api/workflows/{id}/` — inspect a workflow manifest and status.

### Tools

- `GET /api/tools/` — list tool registry entries and capability bundles.
- `GET /api/tools/{id}/` — inspect a tool definition.

### Memory

- `GET /api/memory/namespaces/` — list visible memory namespaces.
- `GET /api/memory/datasets/` — list dataset manifests.

### Traces

- `GET /api/traces/{task_id}/events/` — read task events.
- `GET /api/traces/{task_id}/artifacts/` — read task artifacts.
- `GET /api/traces/{task_id}/logs/` — read task logs.

## App-Scoped Endpoint Groups

Each app under `utils/apps/` exposes endpoints under its namespace:

### Projects

- `GET /api/projects/` — list projects.
- `POST /api/projects/` — create a project.
- `GET /api/projects/{id}/` — retrieve a project.
- `PATCH /api/projects/{id}/` — update a project.
- `DELETE /api/projects/{id}/` — delete a project.

### Notes

- `GET /api/notes/` — list notes.
- `POST /api/notes/` — create a note.
- `GET /api/notes/{id}/` — retrieve a note.
- `PATCH /api/notes/{id}/` — update a note.
- `DELETE /api/notes/{id}/` — delete a note.

### Jobs

- `GET /api/jobs/` — list jobs.
- `POST /api/jobs/` — create a job.
- `GET /api/jobs/{id}/` — retrieve a job.

### Calendar

- `GET /api/calendar/events/` — list calendar events.
- `POST /api/calendar/events/` — create an event.

### Recipes, IMDBSpy, Exercise, Timekeeper

Endpoint groups to be defined when each app module is implemented. Reserve namespaces:

- `/api/recipes/`
- `/api/imdbspy/`
- `/api/exercise/`
- `/api/timekeeper/`

## Contract Rules

- Responses must be structured and schema validated.
- Errors must include a stable code, human-readable message, and optional details.
- Frontend code must not assume an endpoint exists until it is listed here.
- Agent tools in `utils/apps/{app}/agent/tools.py` must call the same services backing these endpoints.
- Pagination uses cursor or offset parameters; default page size is 25.
- Authentication headers and permission scopes to be defined when auth is implemented.

## Implementation Location

- Route definitions: `api/routes/`
- Serializers: `api/serializers/` and `utils/apps/{app}/backend/api/`
- Request validation: `api/schemas/`
- Middleware: `api/middleware/`
