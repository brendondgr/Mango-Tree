# Projects

Domain app module under `utils/apps/projects/`.

## Layout

- `backend/` — Django models, services, API views, Celery tasks
- `frontend/` — UI fragments consumed by the `web/` shell
- `agent/` — LangGraph tools (`tools.py`) and prompts (`prompts.py`)
- `shared/` — Domain logic used by both API and agent layers

## Rules

- Business logic lives in `backend/services/` or `shared/`.
- Agent tools call services; never duplicate domain logic.
- DRF views are thin wrappers over services.

See `docs/skills/app-modules/`.
