# GitHub Copilot Instructions

This repository builds Mango Tree, a local-first personal agent platform with explicit permissions and traceable workflows.

## Project Rules

- Use `uv` for Python commands and dependency management.
- Put agent orchestration in `agents/`.
- Put API surface in `api/`.
- Put app domain code in `utils/apps/{app_name}/`.
- Put shared foundations in `utils/shared/`.
- Put frontend code in `web/`.
- Put documentation in `docs/`.
- Treat skills as instruction packs in `docs/skills/`, workflows as executable LangGraph graphs in `agents/`, tools as executable capabilities, datasets as knowledge sources, and policies as access control.
- Do not design one agent with every tool loaded. Route through a coordinator and scoped app tools.
- Add denial tests when touching permissions, tools, filesystem, shell, network, memory, datasets, schemas, or workflow boundaries.
- App services are the single source of domain truth; UI and agents both call them.

## Frontend Rules

- React/Vite SPA with TanStack Router, TanStack Query, Zustand, Tailwind CSS, and shadcn/ui.
- Apply the Mango theme from `docs/skills/ui-frontend/`.
- Prefer compact dashboard surfaces over marketing layouts.
- Ensure keyboard focus, readable text, and responsive behavior.
- Do not extend the legacy Astro skeleton.

## Backend Rules

- Django and DRF for the HTTP API.
- LangGraph under `agents/` for orchestration.
- Celery and Redis for background tasks.
- PostgreSQL with pgvector for data and embeddings.
