# Deployment

Mango Tree is local-first. Deployment guidance covers local development.

## Prerequisites

- Python 3.13+ with `uv`.
- Node.js with `npm`.
- PostgreSQL with pgvector extension.
- Redis (for Celery and caching).
- S3-compatible object storage (optional for local dev).

## Python Backend

Use `uv` for dependency management:

```bash
uv sync
uv run manage.py migrate
uv run manage.py runserver
```

ASGI server for production-like local development:

```bash
uv run uvicorn config.django.asgi:application --reload
```

Celery worker:

```bash
uv run celery -A config.django worker --loglevel=info
```

Tests:

```bash
uv run manage.py test
uv run pytest
```

## Frontend

### Target (React/Vite)

When the React/Vite scaffold replaces the legacy Astro skeleton:

```bash
cd web
npm install
npm run dev
npm run build
npm run preview
```

### Legacy (Astro skeleton)

The current Astro skeleton supports:

```bash
cd web
npm install
npm run dev
npm run build
npm run preview
npm run check
```

Do not extend the Astro skeleton. Replace it during Phase 1 of the rebuild.

## Environment Configuration

Configuration lives in `config/`:

- `config/django/` — Django settings (development, production).
- `config/models.yaml` — model provider configuration.
- `config/agents.yaml` — agent definitions.
- `config/tools.yaml` — tool registry.
- `config/permissions.yaml` — permission policies.
- `config/workflows.yaml` — workflow manifests.

Environment variables and secrets should not be committed. Use `.env` files excluded by `.gitignore`.

## Services

| Service | Default | Purpose |
| --- | --- | --- |
| PostgreSQL | localhost:5432 | Primary database |
| Redis | localhost:6379 | Celery broker, cache |
| Django/DRF | localhost:8000 | HTTP API |
| Vite dev server | localhost:5173 | Frontend dev |
| Celery worker | — | Background tasks |

No Docker requirement is defined yet.
