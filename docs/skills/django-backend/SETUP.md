# Django Backend Setup

## Decisions

- Framework: Django with DRF.
- App modules: `utils/apps/{name}/backend/`.
- API shell: `api/`.
- Config: `config/django/`.
- Task queue: Celery with Redis.
- Database: PostgreSQL with pgvector.
- Python tooling: `uv`.

## Commands

```bash
uv run manage.py migrate
uv run manage.py test
uv run manage.py runserver
uv run pytest utils/tests/api/
uv run pytest utils/tests/utils/
```

## Required Docs

Keep synchronized:

- `docs/platform.md`
- `docs/api.md`
