# API Contract

No backend API is implemented yet. This document defines the contract between the React/Vite frontend and the Django/DRF backend.

## Base URL

All endpoints are prefixed with `/api/`.

## Error Schema

```json
{
  "code": "permission_denied",
  "message": "Human-readable summary.",
  "details": {}
}
```

Stable codes: `validation_error`, `permission_denied`, `not_found`, `conflict`, `internal_error`.

## Platform Endpoints

| Group | Endpoints |
| --- | --- |
| Tasks | `POST/GET /api/tasks/`, `GET /api/tasks/{id}/`, `POST /api/tasks/{id}/cancel/` |
| Agents | `GET /api/agents/`, `GET /api/agents/{id}/` |
| Workflows | `GET /api/workflows/`, `GET /api/workflows/{id}/` |
| Tools | `GET /api/tools/`, `GET /api/tools/{id}/` |
| Memory | `GET /api/memory/namespaces/`, `GET /api/memory/datasets/` |
| Traces | `GET /api/traces/{task_id}/events|artifacts|logs/` |

## App Endpoints

### Projects

`GET/POST /api/projects/`, `GET/PATCH/DELETE /api/projects/{id}/`

### Notes

`GET/POST /api/notes/`, `GET/PATCH/DELETE /api/notes/{id}/`

### Jobs

`GET/POST /api/jobs/`, `GET /api/jobs/{id}/`

### Calendar

`GET/POST /api/calendar/events/`

### Reserved (TBD)

`/api/recipes/`, `/api/imdbspy/`, `/api/exercise/`, `/api/timekeeper/`

## Rules

- Responses must be structured and schema validated.
- Frontend must not assume an endpoint exists until listed here.
- Agent tools in `utils/apps/{app}/agent/tools.py` must call the same services backing these endpoints.
- Default pagination page size: 25.

## Implementation

| Concern | Location |
| --- | --- |
| Routes | `api/routes/` |
| Serializers | `api/serializers/`, `utils/apps/{app}/backend/api/` |
| Schemas | `api/schemas/` |
| Middleware | `api/middleware/` |

Platform overview: `docs/platform.md`.
