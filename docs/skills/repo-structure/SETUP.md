# Repository Structure Setup

This repository is configured as a local-first Django/DRF platform with LangGraph agents and a React/Vite frontend.

## Defaults

- Primary runtime: Python 3.13+ with `uv`.
- Backend: Django 5.2 and DRF over SQLite. No task queue, no PostgreSQL.
- Agent layer: LangGraph under `utils/agents/` — one graph, in `coordinator/`.
- Frontend runtime: Node with `npm`, under `web/`.
- Repository shape: monorepo with modular apps under `utils/apps/`.
- Shared code: app services in `utils/apps/{name}/`; cross-app utilities in `utils/shared/`.
- API contracts: `docs/api.md`. There is no generated OpenAPI schema.
- Tests: `utils/tests/` grouped by agents, api, config, utils/apps, utils/shared.
  Frontend tests live beside their source under `web/src/`.

## Required Documentation

Maintain these files:

- `docs/platform.md` — architecture, structure, routes, deployment, testing
- `docs/api.md` — HTTP API contract

## Validation Commands

```bash
uv run manage.py migrate
```

```bash
uv run pytest
```

```bash
cd web && npm test && npm run build
```
