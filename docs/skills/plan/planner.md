# Planning Reference

Mango Tree plans should be decision complete and practical for another coding agent to execute without inventing core architecture.

## Required Content

- State the goal in one or two sentences.
- Identify the runtime boundary being changed.
- List implementation steps in dependency order.
- Name important schemas, config files, commands, and documentation updates.
- Include tests for both allowed and denied behavior.
- Call out any frontend route, component, or API contract changes.

## Validation Expectations

Use validation that matches the affected subsystem:

- Python runtime: `uv run pytest` or a smaller targeted `uv run pytest tests/<area>`.
- Skill metadata: `uv run read-yaml.py`.
- Frontend: `cd web && npm install`, `npm run build`, and `npm run check` when available.
- Documentation: confirm docs mention routing, scoped tools, structured outputs, and permission boundaries when relevant.

## Git Guidance

Do not include automatic commit or push instructions unless the user explicitly asks for them. Prefer a short verification summary at the end of each implementation phase.
