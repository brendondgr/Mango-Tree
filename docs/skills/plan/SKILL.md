---
name: plan
description: Use this skill when creating, refining, or reviewing implementation plans for the Mango Tree local agent runtime, especially phased work involving orchestration, specialists, permissions, tests, documentation, or frontend setup.
---

# Mango Tree Planning Skill

Plan work as a sequence of small, verifiable changes for a local-first agent runtime. The repository is intended to become a permissioned system where an orchestrator routes requests to a general agent or scoped LangGraph specialist workflows.

## Project Priorities

- Keep the orchestrator as a dispatcher, not an unrestricted worker.
- Keep specialist workflows narrow: explicit input schemas, output schemas, tool bundles, memory namespaces, dataset permissions, and filesystem scopes.
- Prefer enforceable runtime policy over prompt-only safety.
- Preserve traceability through task events, artifacts, logs, structured outputs, and test reports.
- Use `uv` for Python package and command execution.
- Treat `web/` as the future Astro frontend boundary.

## Planning Rules

- Start with the smallest milestone that proves a runtime contract.
- Name the subsystem being changed: inference, orchestration, agents, workflows, tools, memory, storage, sandbox, schemas, observability, docs, or web.
- Include acceptance criteria that prove routing, permission checks, schema validation, and traceability.
- Include denial tests whenever a change touches tools, memory, datasets, filesystem access, shell access, or workflow permissions.
- For frontend work, require architecture docs before UI expansion and preserve the Pulse Light design tokens.

## Expected Plan Shape

Use concise Markdown with:

1. Summary
2. Implementation steps grouped by subsystem
3. Public interface or schema changes
4. Test and validation plan
5. Assumptions

Avoid giant file inventories unless the exact paths are needed to prevent ambiguity.
