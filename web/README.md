# Web Frontend

This directory contains the Mango Tree frontend.

## Status: Legacy Astro Skeleton

The current contents are a **legacy Astro skeleton** (Astro, Svelte/React islands, UnoCSS) that will be replaced during Phase 1 of the rebuild documented in `docs/rebuild-plan.md`.

**Do not extend the Astro skeleton.** New frontend work follows the React/Vite architecture:

- React, TypeScript, Vite
- TanStack Router, TanStack Query, Zustand
- Tailwind CSS, shadcn/ui, Radix UI, Framer Motion
- Mango theme (derived from Pulse Light palette)

See `docs/skills/website-architecture/` and `docs/skills/ui-frontend/` for the target structure and design system.

## Target Layout

```text
web/src/
├── app/          # router, providers, layouts, stores
├── components/   # ui, forms, tables, charts, markdown
├── features/     # chat, dashboard, command-palette, memory, settings
├── pages/        # dashboard, projects, notes, jobs, calendar
├── hooks/
├── lib/
├── services/     # API clients only
├── types/
└── styles/       # Mango theme CSS variables
```

## Commands (Legacy)

```bash
npm install
npm run dev
npm run build
```

These commands apply to the current Astro skeleton. They will change when the React/Vite scaffold replaces it.
