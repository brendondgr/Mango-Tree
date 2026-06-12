---
name: django-backend
description: Use this skill when working on the Mango Tree Django/DRF backend, including project settings, app registration under utils/apps/, serializers, ASGI, Celery tasks, migrations, and API routes.
---

# Mango Tree Django Backend Skill

The backend is a Django/DRF platform with modular apps under `utils/apps/`. The `api/` layer exposes HTTP endpoints; domain logic lives in app services.

## Stack

- Django and Django REST Framework.
- ASGI with Uvicorn.
- Celery and Redis for background tasks.
- PostgreSQL with pgvector.
- S3-compatible object storage.
- `uv` for dependency and command management.

## Layout

```text
config/django/          # settings, urls, wsgi, asgi
api/                    # routes, serializers, middleware, schemas
utils/apps/{name}/backend/
  api/                  # DRF views
  models/               # Django models
  services/             # business logic
  tasks/                # Celery tasks
utils/shared/           # auth, permissions, storage, search, embeddings, events
```

## Rules

- Views and serializers are thin. Call services for all domain behavior.
- Register each app module as a Django app from `utils/apps/{name}/backend/`.
- Shared utilities belong in `utils/shared/`, not duplicated per app.
- Celery tasks delegate to services; do not embed business logic in task bodies.
- Migrations live with app models under `utils/apps/{name}/backend/models/`.
- Enforce permissions in code via `utils/shared/permissions/` and execution context.
- API errors use stable codes with human-readable messages and optional details.

## Commands

```bash
uv run manage.py migrate
uv run manage.py test
uv run manage.py runserver
uv run celery -A config.django worker
```

## API Parity

Every capability exposed to the UI via DRF should be reachable by agents through registered tools in `utils/apps/{name}/agent/tools.py` that call the same services.

See also `docs/skills/app-modules/` and `docs/skills/repo-structure/structures/django-apps.md`.
