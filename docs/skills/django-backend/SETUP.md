# Django Backend Setup

## Decisions

- Framework: Django 5.2 with DRF.
- App modules: `utils/apps/{name}/backend/`.
- Route modules: `utils/api/routes/`, included by `config/django/urls.py`.
- Config: `config/django/settings.py` — one settings module, no dev/prod split.
- Database: SQLite, one connection per ORM-backed app, bound by routers.
- Storage: local filesystem under `data/`.
- Auth: session cookie, `IsAuthenticated` by default across the whole API.
- Task queue: none.
- Python tooling: `uv`, Python 3.13+.

## Commands

```bash
uv sync --extra dev
```

```bash
uv run manage.py migrate
```

```bash
uv run manage.py migrate --database=imdbspy
```

```bash
uv run pytest
```

```bash
uv run pytest utils/tests/api/
```

Pytest is configured in `pyproject.toml` (`testpaths = ["utils/tests"]`,
`DJANGO_SETTINGS_MODULE = "config.django.settings"`), so a bare `uv run pytest`
from the repo root is the normal invocation.

## Required Docs

Keep synchronized with any backend change:

- `docs/api.md` — every endpoint added, changed, or removed.
- `docs/platform.md` — architecture, storage, and runtime facts.
- `config/README.md` — new YAML keys or database connections.
