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
uv run pytest tests/api/
uv run pytest tests/utils/
```

## Required Docs

Keep synchronized:

- `docs/api-contract.md`
- `docs/architecture.md`
- `docs/data-flow.md`
- `docs/deployment.md`
