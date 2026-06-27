---
name: website-architecture
description: Use this skill when planning, documenting, scaffolding, or changing the Mango Tree React/Vite frontend, including routes, data flow, API boundaries, deployment commands, and frontend/backend contracts.
---

# Mango Tree Website Architecture

The website is the control surface for the Mango platform. It lives under `web/` as a React/Vite SPA and consumes DRF APIs through TanStack Query.

## Required Before UI Expansion

Define or update sections in `docs/platform.md`:

- application mode
- route map
- user roles and auth boundaries
- data-flow map
- frontend/backend boundary
- repository layout
- build, run, and test commands

Also update `docs/api.md` when adding endpoints.

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

API contracts remain documented in `docs/api.md` until runtime endpoints exist. Frontend code must not assume an endpoint exists until listed there.

## Documentation Requirements

Maintain `docs/platform.md` (routes, components, data flow, deployment) and `docs/api.md` (endpoints).

## Data Flow

```text
web/src/services/  ->  utils/api/routes/  ->  utils/apps/{app}/backend/services/
```

No business logic in the frontend beyond API client calls. App-specific UI may live in `utils/apps/{app}/frontend/` and be imported into the shell.

### `/chat` workspace tabs

`WorkspaceHeader` shows a single pinned **Apps** home tab plus a closeable **app tab** for each open app. The apps come from the registry at `web/src/features/workspace/apps/appRegistry.tsx` — one entry (`id`, `label`, `description`, `icon`, `Component`) wires an app into the Apps overview launcher, header tabs, nav-rail quick-launch, and main-body routing. When no app tab is active the Apps overview is shown. Selecting/opening an artifact from the Artifacts tab spawns a single non-persisted **ephemeral tab** for the viewer. See `docs/platform.md` for lifecycle details.

## Commands

```bash
cd web
npm install
npm run dev
npm run build
npm run preview
```
