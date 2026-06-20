# Repository Structure Setup

This repository is configured as a local-first Django/DRF platform with LangGraph agents and a React/Vite frontend.

## Defaults

- Primary runtime: Python with `uv`.
- Backend: Django, DRF, Celery, PostgreSQL.
- Agent layer: LangGraph under `utils/agents/`.
- Frontend runtime: Node with `npm`, under `web/`.
- Repository shape: monorepo with modular apps under `utils/apps/`.
- Shared code: app services in `utils/apps/{name}/`; cross-app utilities in `utils/shared/`.
- API contracts: `docs/api.md` until generated OpenAPI schemas exist.
- Tests: grouped by agents, api, utils/apps, utils/shared, and web.

## Required Documentation

Maintain these files:

- `docs/platform.md` — architecture, structure, routes, deployment, testing
- `docs/api.md` — HTTP API contract

## Validation Commands

```bash
# Backend (when implemented)
uv run manage.py test
uv run manage.py migrate

# Agents and utils
uv run pytest

# Frontend (when React/Vite scaffold exists)
cd web && npm run dev && npm run build
```
