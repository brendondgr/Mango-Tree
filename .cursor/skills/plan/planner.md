# Planning Reference

Mango Tree plans should be decision complete and practical for another coding agent to execute without inventing core architecture.

## Required Content

1. Summary (one or two sentences).
2. Layer affected (`web`, `api`, `agents`, `utils/apps/{name}`, `utils/shared`, `config`, `docs`).
3. Implementation steps in dependency order.
4. API/schema changes.
5. Agent tool changes (if any).
6. Test plan including denial tests for permissions.
7. Migration notes (Flask → app module, if applicable).
8. Important config files, commands, and documentation updates.

## Code Placement Rules

- Business logic → `utils/apps/{app}/backend/services/` or `shared/`.
- Agent tools → `utils/apps/{app}/agent/tools.py` (call services, never duplicate logic).
- UI → `web/src/features/` or `utils/apps/{app}/frontend/`.
- No business logic in `web/src/services/` beyond API client calls.

## Validation Expectations

Use validation that matches the affected layer:

- Backend: `uv run manage.py test` or `uv run pytest tests/utils/apps/{name}/`.
- Agents: `uv run pytest tests/agents/`.
- API: `uv run pytest tests/api/`.
- Frontend: `cd web && npm install`, `npm run build` when the React/Vite scaffold exists.
- Documentation: confirm docs mention routing, scoped tools, structured outputs, and permission boundaries when relevant.

## Flask Migration Checklist

When migrating a Flask app:

**Keep:** models, services, tasks, API logic, utilities.

**Remove:** templates, static assets, page routing, duplicated client-side logic.

**Reorganize into:** `utils/apps/{name}/` standard layout.

## Git Guidance

Do not include automatic commit or push instructions unless the user explicitly asks for them. Prefer a short verification summary at the end of each implementation phase.
