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

### Health

`GET /api/health/` — returns `{"status":"ok"}` when the Django API is running.

## App Endpoints

### Projects

`GET/POST /api/projects/`, `GET/PATCH/DELETE /api/projects/{id}/`

### Notes

`GET/POST /api/notes/`, `GET/PATCH/DELETE /api/notes/{id}/`

### Jobs

`GET/POST /api/jobs/`, `GET /api/jobs/{id}/`

### Calendar

`GET/POST /api/calendar/events/`

### Media Viewer (Artifacts)

Local artifact storage and streaming for the `/chat` workspace. See `utils/apps/media_viewer/README.md`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/media-viewer/artifacts/` | List artifacts (paginated, default 25, sort `-created_at`) |
| `POST` | `/api/media-viewer/artifacts/` | Upload + register artifact (`multipart/form-data`) |
| `GET` | `/api/media-viewer/artifacts/{id}/` | Artifact metadata |
| `DELETE` | `/api/media-viewer/artifacts/{id}/` | Delete artifact and files |
| `GET` | `/api/media-viewer/artifacts/{id}/content/` | Stream raw bytes (`Content-Disposition: inline` or `attachment`) |
| `GET` | `/api/media-viewer/artifacts/{id}/thumbnail/` | Stream thumbnail (404 when missing; UI falls back to kind icon) |

#### `POST /api/media-viewer/artifacts/` (multipart)

| Field | Required | Notes |
| --- | --- | --- |
| `file` | yes | Raw bytes |
| `source` | no | Default `manual`; chat integration sends `chat_upload` |
| `source_chat_session_id` | no | UUID string |
| `source_message_id` | no | UUID string |
| `poster` | no | Optional image for video poster (client-extracted frame) |

#### List response

```json
{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "uuid",
      "filename": "diagram.png",
      "mime_type": "image/png",
      "kind": "image",
      "size_bytes": 1048576,
      "created_at": "2026-06-11T11:58:00Z",
      "source": "chat_upload",
      "source_chat_session_id": "uuid-or-null",
      "source_message_id": "uuid-or-null",
      "metadata": {
        "width": 1920,
        "height": 1080,
        "duration_seconds": null,
        "page_count": null,
        "language": null,
        "checksum_sha256": "hex"
      }
    }
  ]
}
```

Artifact kinds: `image`, `video`, `pdf`, `markdown`, `latex`, `text`, `unknown`.

### Exercise

Workout/routine/equipment/history tracking with Strava import, migrated from the standalone WorkoutTracker app. See `utils/apps/exercise/README.md`. Data lives in the legacy SQLite store at `data/exercise/workouttracker.db` (bound read/write, schema unchanged). DRF routes: `utils/api/routes/exercise.py`; views call `backend/services/` only.

| Method | Endpoint | Service | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/exercise/workouts/` | `workouts.list_workouts` | List workout templates |
| `POST` | `/api/exercise/workouts/` | `workouts.save_workout` | Create/update a workout (upsert on `id`) |
| `DELETE` | `/api/exercise/workouts/{id}/` | `workouts.delete_workout` | Delete a workout |
| `GET` | `/api/exercise/routines/` | `routines.list_routines` | List weekly routines |
| `POST` | `/api/exercise/routines/` | `routines.save_routine` | Create/update a routine (upsert on `id`) |
| `DELETE` | `/api/exercise/routines/{id}/` | `routines.delete_routine` | Delete a routine |
| `GET` | `/api/exercise/equipment/` | `equipment.list_equipment` | List equipment |
| `POST` | `/api/exercise/equipment/` | `equipment.add_equipment` | Create equipment (409 on duplicate `id`) |
| `PUT` | `/api/exercise/equipment/{id}/` | `equipment.update_equipment` | Update equipment |
| `DELETE` | `/api/exercise/equipment/{id}/` | `equipment.delete_equipment` | Delete equipment |
| `GET` | `/api/exercise/history/` | `history.list_history` | List logged sessions |
| `POST` | `/api/exercise/history/` | `history.add_log` | Add a logged session (409 on duplicate `id`) |
| `PUT` | `/api/exercise/history/{id}/` | `history.update_log` | Update a logged session |
| `DELETE` | `/api/exercise/history/{id}/` | `history.delete_log` | Delete a logged session |

List endpoints return the standard envelope `{count, next, previous, results}` (default `page_size` 25, max 2000 via `?page_size=`). `POST`/`PUT` echo the saved object; `DELETE` returns `204`. Errors use the platform schema with codes `validation_error` (400), `not_found` (404), `conflict` (409).

IDs are the legacy string keys (`wk_…`, `rt_…`, `eq_…`, `hist_…`, `strava_…`). `history.workout_id` may be `run`/`walk` (cardio/Strava) and is not constrained to an existing workout. Strava sync endpoint: added in Stage 7.

### Reserved (TBD)

`/api/recipes/`, `/api/imdbspy/`, `/api/timekeeper/`

## Rules

- Responses must be structured and schema validated.
- Frontend must not assume an endpoint exists until listed here.
- Agent tools in `utils/apps/{app}/agent/tools.py` must call the same services backing these endpoints.
- Default pagination page size: 25.

## Implementation

| Concern | Location |
| --- | --- |
| Routes | `utils/api/routes/` |
| Serializers | `utils/api/serializers/`, `utils/apps/{app}/backend/api/` |
| Schemas | `utils/api/schemas/` |
| Middleware | `utils/api/middleware/` |

Platform overview: `docs/platform.md`.
