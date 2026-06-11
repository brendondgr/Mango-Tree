# Plan Setup

This planning skill is configured for agentic coding workflows in the Mango Tree repository.

## Defaults

- Granularity: detailed engineering plans for phased implementation.
- Validation: targeted tests first, then broader test/build checks when the touched area justifies it.
- Git workflow: no automatic commit or push instructions.
- Audience: coding agents and engineers maintaining a local-first, permissioned agent platform.

## Repository-Specific Focus

Plans should protect these core ideas:

- Coordinator routes and validates under `agents/coordinator/`.
- Planner reasons and delegates under `agents/planner/`.
- Specialist LangGraph workflows and app tools execute narrow tasks.
- Tools enforce permissions through execution context.
- Memory, datasets, filesystem, shell, and network access are scoped by policy.
- Frontend stays under `web/` and follows documented React/Vite architecture.
- App services in `utils/apps/{name}/backend/services/` are the single source of domain truth.

## Validation Commands

```bash
uv run manage.py test
uv run pytest
cd web && npm run build
```
