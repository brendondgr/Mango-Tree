# Mango Tree Agent Instructions

Mango Tree is a local-first, permissioned agent runtime. Build it as a system of scoped workflows rather than one unrestricted agent.

## Architecture

- The orchestrator classifies requests, selects workflows, creates scoped task packages, validates structured results, and records events.
- The general agent performs broad reasoning, light repo inspection, planning, and delegation.
- Specialist LangGraph workflows execute narrow tasks such as repo inspection, code editing, testing, LaTeX building, RAG indexing, and model evaluation.
- Tools are executable capabilities; skills are static instruction packs.
- The tool layer enforces access. Do not rely on prompt text for security.

## Coding Rules

- Use `uv` for Python commands and dependencies.
- Keep Python runtime code under `src/agent_runtime/`.
- Keep frontend code under `web/`.
- Keep docs under `docs/`.
- Add denial tests for permission, filesystem, shell, memory, dataset, and schema boundaries.
- Preserve structured outputs and event/artifact traces for meaningful actions.

## Frontend

The frontend uses Astro with Svelte and React islands, UnoCSS, npm, and the Pulse Light theme. Do not expand UI behavior beyond the documented route map and API contract.
