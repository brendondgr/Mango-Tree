# Django App Structure

Django and DRF provide the HTTP API surface. App domain code lives under `utils/apps/`; the `api/` layer is a thin routing and serialization shell.

## Recommended Layout

```text
config/
|-- django/
|   |-- settings/
|   |-- urls.py
|   |-- wsgi.py
|   `-- asgi.py
|-- models.yaml
|-- agents.yaml
|-- tools.yaml
|-- permissions.yaml
`-- workflows.yaml

api/
|-- routes/
|-- serializers/
|-- middleware/
`-- schemas/

utils/apps/{app_name}/backend/
|-- api/
|   `-- views.py
|-- models/
|-- services/
`-- tasks/
```

## Rules

- Register Django apps from `utils/apps/{name}/backend/`.
- Keep views thin: validate input, call services, serialize output.
- Business logic belongs in `utils/apps/{name}/backend/services/`, not in views or serializers.
- Celery tasks belong in `utils/apps/{name}/backend/tasks/`.
- Shared auth, permissions, and storage utilities belong in `utils/shared/`.
- API routes in `utils/api/routes/` aggregate app endpoints; avoid duplicating URL patterns per app in multiple places.
- Use PostgreSQL with pgvector for relational and embedding data.
- Use S3-compatible storage via `utils/shared/storage/` for file uploads and attachments.

## ASGI and Async

- Serve via ASGI with Uvicorn for async workloads.
- Long-running agent actions queue through Celery and Redis.
- DRF endpoints return structured, schema-validated responses.

## Error Contract

All API errors should include:

```json
{
  "code": "permission_denied",
  "message": "Human-readable summary.",
  "details": {}
}
```

See `docs/api.md` for endpoint groups.
