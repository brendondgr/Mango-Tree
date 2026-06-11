# Architecture

Mango Tree is organized as a layered monorepo:

```text
User
  -> web/ (React SPA)
      -> api/ (DRF)
          -> utils/apps/{app}/backend/services/
  -> agents/coordinator
      -> agents/planner
      -> utils/apps/{app}/agent/tools
          -> utils/apps/{app}/backend/services/
```

## Layer Responsibilities

| Layer | Path | Role |
| --- | --- | --- |
| Frontend | `web/` | Dashboard shell, navigation, chat, command palette; consumes APIs only |
| API | `api/` | DRF routes, serializers, middleware, request validation |
| Agents | `agents/` | LangGraph coordinator, planner, memory, tools, providers |
| Apps | `utils/apps/{name}/` | Domain logic, models, services, frontend fragments, agent tools |
| Shared | `utils/shared/` | Auth, permissions, storage, search, embeddings, events |
| Config | `config/` | Django settings and runtime YAML |

## Runtime Flow

```text
User request
  -> agents/coordinator (classify, route, validate)
  -> agents/planner (broad reasoning) OR app specialist workflow
  -> agents/tools (registry + execution context)
  -> utils/apps/{app}/backend/services (domain logic)
  -> Event, artifact, and result records
  -> Structured response
```

Both the UI and agents reach domain logic through the same service layer. The UI path goes through `api/`; the agent path goes through registered tools in `utils/apps/{app}/agent/tools.py`.

## Agent Responsibilities

- Coordinator: classify requests, choose routes, assemble scoped task packages, validate results, record events.
- Planner: broad reasoning, lightweight inspection, planning, and delegation.
- Specialists: constrained LangGraph workflows with narrow schemas, tool bundles, memory namespaces, and filesystem permissions.
- Tools: registered executable functions with schemas and permission metadata in `agents/tools/`.
- Policies: code-enforced boundaries via `utils/shared/permissions/`.

## Frontend Mode

The target frontend is a React/Vite SPA under `web/` with TanStack Router, TanStack Query, Zustand, Tailwind CSS, and shadcn/ui. The current directory may contain a legacy Astro skeleton until Phase 1 of the rebuild replaces it.

The frontend does not contain business logic. It consumes DRF endpoints documented in `docs/api-contract.md`.

## Backend Stack

- Django and Django REST Framework.
- LangGraph under `agents/`.
- Celery and Redis for background tasks.
- PostgreSQL with pgvector.
- Llama-CPP and provider abstraction for model inference.
- S3-compatible object storage.

See `docs/rebuild-plan.md` for the full rebuild reference.
