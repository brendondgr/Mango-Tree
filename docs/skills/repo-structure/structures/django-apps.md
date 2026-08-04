# Django App Structure

Django and DRF provide the HTTP API surface. App domain code lives under
`utils/apps/`; `utils/api/routes/` is a thin routing shell.

## Actual Layout

```text
config/
├── django/
│   ├── settings.py       # one module, no dev/prod split
│   ├── urls.py
│   ├── views.py          # root redirect, favicon, health
│   ├── wsgi.py
│   └── asgi.py
├── artifacts.yaml
├── models.yaml
├── permissions.yaml
├── search.yaml
└── tools.yaml

utils/api/routes/         # one URLconf module per app

utils/apps/{app_name}/backend/
├── api/
│   └── views.py
├── models/               # only for ORM-backed apps
├── services/
└── db_router.py          # only for ORM-backed apps
```

There is no `config/agents.yaml` and no `config/workflows.yaml`.

## Rules

- Register an app in `INSTALLED_APPS` only when it has models. calendar,
  mailbox, and media_viewer are file-store apps wired by URL include alone.
- Keep views thin: validate input, call services, serialize output.
- Business logic belongs in `utils/apps/{name}/backend/services/`, never in
  views or serializers.
- Shared auth and search utilities belong in `utils/shared/`.
- `utils/api/routes/` aggregates app endpoints; do not duplicate URL patterns.
- Every endpoint is behind `IsAuthenticated` unless deliberately marked
  `AllowAny`.

## Storage and persistence

SQLite only — a `default` connection plus one per ORM-backed app, bound by a
`db_router.py` registered in `DATABASE_ROUTERS` and overridable with
`MANGO_{APP}_DB`. Apps binding a legacy database use `managed = False` models
and must never have migrations generated for them.

Files go to the local filesystem under `data/`. There is no object storage.

There is no PostgreSQL, pgvector, Redis, Celery, or Uvicorn in this project. Do
not write code or documentation that assumes them.

## Error Contract

All API errors include:

```json
{
  "code": "permission_denied",
  "message": "Human-readable summary.",
  "details": {}
}
```

Stable codes: `validation_error`, `permission_denied`, `not_found`, `conflict`,
`rate_limited`, `internal_error`.

See `docs/api.md` for the endpoint contract.
