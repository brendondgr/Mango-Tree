# Mango Tree Documentation

Mango Tree is a local-first personal agent platform with strong boundaries. It routes user requests through a coordinator, delegates broad reasoning to a planner, and executes narrow work through specialist LangGraph workflows and app-scoped tools.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite, TanStack Router, TanStack Query, Zustand, Tailwind CSS, shadcn/ui |
| API | Django REST Framework |
| Backend | Django, ASGI/Uvicorn |
| Agents | LangGraph under `agents/` |
| Tasks | Celery, Redis |
| Database | PostgreSQL, pgvector |
| Models | Llama-CPP, provider abstraction for cloud models |
| Storage | S3-compatible object storage |
| Python tooling | `uv` |

## Core Concepts

- Skills are static instruction packs in `docs/skills/`.
- Workflows are executable LangGraph graphs under `agents/`.
- Tools are executable capabilities registered in `agents/tools/` and `utils/apps/{app}/agent/`.
- Datasets are knowledge sources with namespace policies.
- Policies are access control enforced in code via `utils/shared/permissions/`.

The model can request tool calls, but the runtime decides whether the call is legal.

## Repository Layout

```text
web/           # React/Vite SPA
api/           # DRF surface
agents/        # LangGraph orchestration
utils/apps/    # Domain app modules
utils/shared/  # Cross-app foundations
config/        # Django settings and runtime YAML
docs/          # Documentation and skills
tests/         # Automated tests
```

## Skill Source Layout

Canonical skill documents live under `docs/skills/`. Symlinks in `.claude/skills/` and `.codex/skills/` point to those central documents.

Available skills:

- `repo-structure` — repository layout and layer rules
- `django-backend` — Django/DRF backend conventions
- `app-modules` — app standard under `utils/apps/`
- `website-architecture` — React/Vite frontend architecture
- `ui-frontend` — Mango theme and UI patterns
- `plan` — phased implementation planning

## Rebuild Reference

See `docs/rebuild-plan.md` for the full monorepo rebuild plan.
