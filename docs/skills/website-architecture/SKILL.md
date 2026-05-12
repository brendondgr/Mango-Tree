---
name: website-architecture
description: Use this skill when planning, documenting, scaffolding, or changing the Mango Tree Astro frontend, including routes, data flow, API boundaries, deployment commands, and frontend/backend contracts.
---

# Mango Tree Website Architecture

The website is a future control surface for the local agent runtime. It lives under `web/` and uses Astro as the app shell with Svelte and React islands plus UnoCSS styling.

## Required Before UI Expansion

Define or update:

- application mode
- route map
- user roles and auth boundaries
- data-flow map
- frontend/backend boundary
- repository layout
- documentation files
- build, run, and test commands

## Selected Mode

Primary mode: Astro frontend.

Secondary integrations:

- Svelte components for lightweight interactive widgets.
- React components for ecosystem-heavy UI islands.
- UnoCSS for utility styles and design tokens.

## Current Boundary

The first setup creates structure and documentation only. It does not implement a full product UI or connect to a live backend. API contracts remain documented in `docs/api-contract.md` until runtime endpoints exist.

## Documentation Requirements

Maintain:

- `docs/architecture.md`
- `docs/structure.md`
- `docs/routes.md`
- `docs/component-map.md`
- `docs/data-flow.md`
- `docs/deployment.md`
- `docs/api-contract.md`
