# Data Flow

## UI Data Flow

```text
User action in web/
  -> web/src/services/ (API client)
  -> api/routes/ (DRF view)
  -> utils/apps/{app}/backend/services/ (domain logic)
  -> PostgreSQL / S3 / Redis
  -> Structured JSON response
  -> TanStack Query cache
  -> React component render
```

The frontend must not contain business logic beyond API client calls. App-specific UI fragments in `utils/apps/{app}/frontend/` receive data via props or hooks that call `web/src/services/`.

## Agent Data Flow

```text
User request
  -> agents/coordinator (route decision)
  -> agents/planner OR app specialist workflow
  -> agents/tools (registry + execution context)
  -> utils/apps/{app}/agent/tools.py
  -> utils/apps/{app}/backend/services/ (same domain logic as UI)
  -> Event, artifact, and result records
  -> Structured response
```

Agents and the UI share the same service layer. The UI reaches services through DRF; agents reach services through registered tools.

## Background Task Flow

```text
API or agent trigger
  -> utils/apps/{app}/backend/tasks/ (Celery task)
  -> utils/apps/{app}/backend/services/
  -> Redis queue / PostgreSQL / S3
  -> Event recorded in utils/shared/events/
  -> Frontend polls or receives update via TanStack Query
```

## Access Boundaries

- Memory and dataset access must be namespace checked via `agents/memory/` and `utils/shared/permissions/`.
- Filesystem, shell, and network actions must be policy checked before side effects happen.
- API endpoints enforce permissions via DRF middleware and `utils/shared/auth/`.
- Agent tools enforce permissions via execution context in `agents/tools/`.

## Current State

No live backend or API endpoints exist yet. Frontend code should not assume an endpoint exists until documented in `docs/api-contract.md`.

The legacy Astro skeleton uses static placeholder content only.
