# Repository Structure Setup

This repository is configured as a local-first Python agent runtime with a future Astro frontend.

## Defaults

- Primary runtime: Python with `uv`.
- Frontend runtime: Node with `npm`, under `web/`.
- Repository shape: single agent-runtime project with a nested frontend app.
- Shared code: runtime schemas live in `src/agent_runtime/schemas/`; frontend/backend API contracts live in `docs/api-contract.md` until generated contracts are needed.
- Tests: grouped by orchestration, tools, agents, workflows, memory, and sandbox.

## Required Documentation

Maintain these files:

- `docs/documentation.md`
- `docs/architecture.md`
- `docs/structure.md`
- `docs/routes.md`
- `docs/component-map.md`
- `docs/data-flow.md`
- `docs/deployment.md`
- `docs/api-contract.md`
