---
name: website-architecture
description: Use this skill when planning, documenting, scaffolding, or changing the Mango Tree React/Vite frontend, including routes, data flow, API boundaries, deployment commands, and frontend/backend contracts.
---

# Mango Tree Website Architecture

The website is the control surface for the Mango platform. It lives under `web/` as a React/Vite SPA and consumes DRF APIs through TanStack Query.

## Required Before UI Expansion

Define or update:

- application mode
- route map (`docs/routes.md`)
- user roles and auth boundaries
- data-flow map (`docs/data-flow.md`)
- frontend/backend boundary
- repository layout
- documentation files
- build, run, and test commands

## Selected Mode

Primary mode: React/Vite SPA.

Supporting libraries:

- TanStack Router for route-based modularity.
- TanStack Query for server-state caching.
- Zustand for lightweight UI state.
- Tailwind CSS and shadcn/ui for components.
- Radix UI for accessible primitives.
- Framer Motion for transitions.
- React Hook Form and Zod for forms and validation.
- react-markdown for notes and agent output.
- Recharts for dashboards.
- cmdk for command palette.

## Current Boundary

The repository may still contain a legacy Astro skeleton in `web/`. Do not extend it. The target architecture is React/Vite as documented in `docs/skills/repo-structure/structures/web-interfaces.md`.

API contracts remain documented in `docs/api-contract.md` until runtime endpoints exist. Frontend code must not assume an endpoint exists until listed there.

## Documentation Requirements

Maintain:

- `docs/architecture.md`
- `docs/structure.md`
- `docs/routes.md`
- `docs/component-map.md`
- `docs/data-flow.md`
- `docs/deployment.md`
- `docs/api-contract.md`

## Data Flow

```text
web/src/services/  ->  api/routes/  ->  utils/apps/{app}/backend/services/
```

No business logic in the frontend beyond API client calls. App-specific UI may live in `utils/apps/{app}/frontend/` and be imported into the shell.

## Commands

```bash
cd web
npm install
npm run dev
npm run build
npm run preview
```
