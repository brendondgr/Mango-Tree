---
name: django-backend
description: Use this skill when working on the Mango Tree Django/DRF backend, including project settings, app registration under utils/apps/, database bindings and routers, DRF views and serializers, migrations, and API routes.
---

# Mango Tree Django Backend Skill

A Django/DRF backend with modular apps under `utils/apps/`. `utils/api/routes/`
exposes HTTP endpoints; domain logic lives in app services.

## Stack

- Django 5.2 and Django REST Framework.
- SQLite — a `default` connection plus one per SQLite-backed app, with routers.
- Local filesystem storage under `data/`.
- `uv` for dependency and command management, Python 3.13+.

There is **no** Celery, Redis, PostgreSQL, pgvector, S3, or Uvicorn in this
project. Do not write code, commands, or docs that assume them. A few apps have
`backend/tasks/` modules, but no broker runs them — they are called inline.

## Layout

```text
config/django/            # settings.py, urls.py, views.py, wsgi.py, asgi.py
utils/api/routes/         # one URLconf module per app, included under /api/
utils/apps/{name}/backend/
  api/                    # DRF views and serializers
  models/                 # Django models (only for ORM-backed apps)
  services/               # business logic
  db_router.py            # routes this app's models to its own connection
utils/shared/             # auth, search, llm, events
```

## Databases

`settings.py` defines six SQLite connections. Three patterns are in use, and the
right one depends on who owns the schema:

- **Legacy database, bound read/write.** exercise, projectmanager, timekeeper.
  Models are `managed = False` against tables a previous standalone app created.
  Never generate migrations for these — an accidental `makemigrations` that gets
  applied will corrupt real user data.
- **Django-owned.** imdbspy. Normal managed models and migrations, applied with
  `migrate --database=imdbspy`.
- **No ORM at all.** calendar, mailbox, media_viewer store JSON or files under
  `data/` and are not in `INSTALLED_APPS`; they are wired by URL include alone.

Each ORM-backed app needs a `db_router.py` registered in `DATABASE_ROUTERS`, and
a `MANGO_{APP}_DB` environment override for its path.

## Rules

- Views and serializers stay thin. Call services for all domain behavior.
- Register an app in `INSTALLED_APPS` only when it has models.
- Shared utilities belong in `utils/shared/`, not duplicated per app.
- `IsAuthenticated` is the project-wide DRF default. A new endpoint is closed
  unless you deliberately mark it `AllowAny`, and you should have a reason.
- API errors use stable codes (`validation_error`, `permission_denied`,
  `not_found`, `conflict`, `rate_limited`, `internal_error`) with a
  human-readable message and optional details.
- Adding an endpoint means updating `docs/api.md` in the same change.

## API parity

Every capability exposed to the UI through DRF should be reachable by the agent
through a tool in `utils/apps/{name}/agent/tools.py` that calls the same
service. A tool also needs an entry in `config/tools.yaml` — the registry is
config-driven, not decorator-driven.

## Commands

```bash
uv run manage.py migrate
```

```bash
uv run manage.py runserver 32553
```

```bash
uv run pytest
```

Note the port: `run.py` and the Vite proxy both expect Django on **32553**, not
Django's default 8000.

See also `docs/skills/app-modules/` and
`docs/skills/repo-structure/structures/django-apps.md`.
