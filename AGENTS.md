# Mango Tree Agent Instructions

Mango Tree is a local-first, permissioned agent platform. Build it as a system of scoped workflows and modular apps rather than one unrestricted agent.

## Architecture

- The coordinator classifies requests, selects workflows, creates scoped task packages, validates structured results, and records events.
- The planner performs broad reasoning, light inspection, planning, and delegation.
- Specialist LangGraph workflows execute narrow tasks with app-scoped tools and services.
- Tools are executable capabilities; skills are static instruction packs in `docs/skills/`.
- The tool layer enforces access. Do not rely on prompt text for security.

## Layer Responsibilities

| Layer | Path | Role |
| --- | --- | --- |
| Frontend | `web/` | React SPA shell; consumes APIs only |
| API | `api/` | DRF routes, serializers, middleware, schemas |
| Agents | `agents/` | LangGraph orchestration: coordinator, planner, memory, tools, providers |
| Apps | `utils/apps/{name}/` | Domain logic, backend, frontend fragments, agent tools |
| Shared | `utils/shared/` | Auth, permissions, storage, search, embeddings, events |
| Config | `config/` | Django settings and runtime YAML configuration |

The frontend must not contain business logic beyond API client calls.  
Agents must consume tool interfaces, not UI internals.  
App services are the single source of truth for domain behavior.

## Backend Stack

- Django and Django REST Framework for the HTTP API.
- LangGraph for coordinator and specialist workflows under `agents/`.
- Celery and Redis for background tasks and queued agent actions.
- PostgreSQL with pgvector for relational data and embeddings.
- Llama-CPP and provider abstraction for local and cloud model inference.
- S3-compatible object storage for files and generated assets.

## Coding Rules

- Use `uv` for Python commands and dependencies.
- Keep agent orchestration under `agents/`.
- Keep app domain code under `utils/apps/{app_name}/`.
- Keep shared foundations under `utils/shared/`.
- Keep API surface under `api/`.
- Keep frontend code under `web/`.
- Keep docs under `docs/`.
- Add denial tests for permission, filesystem, shell, memory, dataset, and schema boundaries.
- Preserve structured outputs and event/artifact traces for meaningful actions.

## Frontend

The target frontend uses React, TypeScript, Vite, TanStack Router, TanStack Query, Zustand, Tailwind CSS, shadcn/ui, Radix UI, and Framer Motion. Apply the Mango theme (derived from Pulse Light palette) via shadcn/Tailwind tokens.

The current `web/` directory contains a legacy Astro skeleton that will be replaced. Do not expand legacy Astro behavior. New UI work follows the React/Vite architecture in `docs/skills/website-architecture/`.

Do not expand UI behavior beyond the documented route map and API contract.

## Skills

Canonical skill documents live under `docs/skills/`. Symlinks in `.claude/skills/` and `.codex/skills/` point to those sources.
