# Website Architecture Setup

Mango Tree uses a React/Vite frontend architecture. A legacy Astro skeleton may remain until Phase 1 of the rebuild replaces it.

## Decisions

- Application type: React/Vite SPA with TanStack Router and Query.
- Styling: Tailwind CSS, shadcn/ui, Mango theme tokens.
- Package manager: npm.
- Auth: none implemented yet; docs should reserve future local operator or admin boundaries.
- Data: static placeholder data only until DRF endpoints exist.
- API: documented contract in `docs/api-contract.md`.
- Deployment: local development first.

## Commands

```bash
cd web
npm install
npm run dev
npm run build
npm run preview
```

## Required Docs

All website architecture changes must keep the route map, component map, data flow, deployment notes, and API contract synchronized.
