---
name: plan
description: Use this skill when creating, refining, or reviewing implementation plans for the Mango Tree platform, especially phased work involving Django/DRF, LangGraph agents, app modules, permissions, tests, documentation, or React/Vite frontend setup.
---

# Mango Tree Planning Skill

Plan work as a sequence of small, verifiable changes for a local-first agent platform. The repository is a permissioned monorepo where a coordinator routes requests to a planner or scoped LangGraph specialist workflows and app tools.

## Project Priorities

- Keep the coordinator as a dispatcher, not an unrestricted worker.
- Keep specialist workflows and app tools narrow: explicit input schemas, output schemas, tool bundles, memory namespaces, dataset permissions, and filesystem scopes.
- Prefer enforceable runtime policy over prompt-only safety.
- Preserve traceability through task events, artifacts, logs, structured outputs, and test reports.
- Use `uv` for Python package and command execution.
- Treat `web/` as the React/Vite frontend boundary (API clients only).
- App domain logic belongs in `utils/apps/{name}/`; agents and API both call the same services.

## Planning Rules

- Start with the smallest milestone that proves a contract.
- Name the layer being changed: `web`, `api`, `agents`, `utils/apps/{name}`, `utils/shared`, `config`, or `docs`.
- Include acceptance criteria that prove routing, permission checks, schema validation, and traceability.
- Include denial tests whenever a change touches tools, memory, datasets, filesystem access, shell access, or workflow permissions.
- For frontend work, require architecture docs before UI expansion and apply the swappable shadcn theme (Canva-inspired default).
- For app work, ensure API and agent tool parity when exposing new capabilities.

## Build Sequence Reference

Follow the build sequence in `docs/platform.md`:

1. Create the new `web/` application shell.
2. Define app boundaries under `utils/apps/{app_name}`.
3. Build the shared API and tool interfaces.
4. Migrate one app at a time.
5. Connect the agent layer to the same app tools used by the UI.
6. Delete old frontend artifacts after replacement is complete.

## Expected Plan Shape

Use concise Markdown with:

1. Summary
2. Layer affected (`web`, `api`, `agents`, `utils/apps/{name}`, `utils/shared`)
3. Implementation steps grouped by layer
4. API/schema changes
5. Agent tool changes (if any)
6. Test plan (including denial tests for permissions)
7. Migration notes (Flask → app module, if applicable)
8. Assumptions

Avoid giant file inventories unless exact paths are needed to prevent ambiguity.

## Validation Commands

```bash
# Backend
uv run manage.py test
uv run manage.py migrate

# Agents and utils
uv run pytest

# Frontend
cd web && npm run dev && npm run build
```
