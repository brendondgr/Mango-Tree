# UI Frontend Setup

The frontend target is a React/Vite SPA with shadcn/ui and the Mango theme.

## Decisions

- Visual direction: professional operational dashboard.
- Theme: Mango (derived from Pulse Light palette) via shadcn/Tailwind CSS variables.
- Frameworks: React, TypeScript, Vite.
- Styling: Tailwind CSS and shadcn/ui.
- Component isolation: ui primitives, features, pages, and app fragments are separated.

## Implementation Expectations

- Keep placeholders minimal and structural until the React/Vite scaffold replaces the legacy Astro skeleton.
- Use `docs/platform.md` and `docs/api.md` as the source of truth.
- Do not invent backend endpoints before `docs/api.md` defines them.
- Do not extend the legacy Astro/UnoCSS skeleton.

## Commands

```bash
cd web
npm install
npm run dev
npm run build
```
