# Claude Code Context

Use the project skills in `.claude/skills/` when working in this repository.

Mango Tree is a local agent platform with strong boundaries:

- Coordinator routes and validates under `agents/coordinator/`.
- Planner reasons and delegates under `agents/planner/`.
- Specialist LangGraph workflows execute constrained work via app tools in `utils/apps/{name}/agent/`.
- Tools enforce permissions through execution context in `agents/tools/`.
- Memory and datasets are namespaced under `agents/memory/` and `utils/shared/`.
- Shell, filesystem, and network access must be policy checked via `utils/shared/permissions/`.

## Layer Boundaries

- `web/` — React/Vite SPA; API clients only, no business logic.
- `api/` — DRF surface consumed by the frontend.
- `agents/` — LangGraph orchestration layer.
- `utils/apps/{name}/` — app domain logic, services, and agent tools.
- `utils/shared/` — cross-app auth, permissions, storage, search, embeddings, events.

For frontend work, follow the React/Vite/shadcn architecture in `docs/skills/website-architecture/` and apply the Mango theme from `docs/skills/ui-frontend/`.

For backend work, follow `docs/skills/django-backend/` and `docs/skills/app-modules/`.

For repository layout, follow `docs/skills/repo-structure/`.

Read `docs/platform.md` for architecture and `docs/api.md` for the HTTP API contract.
