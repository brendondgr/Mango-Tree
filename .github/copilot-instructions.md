# GitHub Copilot Instructions

This repository builds Mango Tree, a local-first personal agent runtime with explicit permissions and traceable workflows.

## Project Rules

- Use `uv` for Python commands and dependency management.
- Put runtime code in `src/agent_runtime/`.
- Put frontend code in `web/`.
- Put documentation in `docs/`.
- Treat skills as instruction packs, workflows as executable graphs, tools as executable capabilities, datasets as knowledge sources, and policies as access control.
- Do not design one agent with every tool loaded. Route through an orchestrator and scoped LangGraph specialists.
- Add denial tests when touching permissions, tools, filesystem, shell, network, memory, datasets, schemas, or workflow boundaries.

## Frontend Rules

- Astro is the primary frontend framework.
- Svelte and React are enabled for islands.
- UnoCSS owns utilities.
- Preserve the Pulse Light theme tokens in `web/src/styles/theme.css`.
- Keep UI professional, operational, accessible, and responsive.
