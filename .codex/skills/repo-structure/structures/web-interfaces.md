# Web Interface Structure

Mango Tree's frontend lives under `web/` as a React/Vite single-page application. The legacy Astro skeleton remains until Phase 1 of the frontend rebuild replaces it.

## Target Layout

```text
web/
|-- public/
|-- index.html
|-- vite.config.ts
|-- package.json
|-- tsconfig.json
`-- src/
    |-- app/
    |   |-- router/
    |   |-- providers/
    |   |-- layouts/
    |   `-- stores/
    |-- components/
    |   |-- ui/
    |   |-- forms/
    |   |-- tables/
    |   |-- charts/
    |   `-- markdown/
    |-- features/
    |   |-- chat/
    |   |-- dashboard/
    |   |-- command-palette/
    |   |-- memory/
    |   `-- settings/
    |-- pages/
    |   |-- dashboard/
    |   |-- projects/
    |   |-- notes/
    |   |-- jobs/
    |   `-- calendar/
    |-- hooks/
    |-- lib/
    |-- services/
    |-- types/
    `-- styles/
```

App-specific UI fragments may also live under `utils/apps/{app_name}/frontend/` and be imported into the shell.

## Stack

- React and TypeScript with Vite.
- TanStack Router for routing.
- TanStack Query for server-state caching.
- Zustand for lightweight UI state.
- Tailwind CSS and shadcn/ui for components.
- Radix UI for accessible primitives.
- Framer Motion for transitions.

## Rules

- Route definitions belong in `web/src/app/router/`.
- Shared chrome belongs in `web/src/app/layouts/`.
- Reusable UI elements belong in `web/src/components/ui/` (shadcn).
- Feature modules belong in `web/src/features/`.
- Page compositions belong in `web/src/pages/`.
- API client calls belong in `web/src/services/`; no business logic beyond request/response handling.
- App-specific components belong in `utils/apps/{app}/frontend/` when they are not shared across the shell.
- Theme tokens live in `web/src/styles/themes/` (swappable via `data-theme`); default is Canva-inspired. Runtime swapper: `web/src/lib/theme.ts`.
- Do not invent backend endpoints before `docs/api.md` defines them.

## Legacy Note

The current `web/` directory may still contain Astro files (`astro.config.mjs`, `src/pages/*.astro`, UnoCSS config). Do not extend these. New work follows the React/Vite layout above.
