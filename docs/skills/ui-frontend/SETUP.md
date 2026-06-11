# UI Frontend Setup

The frontend target is a React/Vite SPA with shadcn/ui and a swappable theme system.

## Decisions

- Visual direction: operational dashboard with Canva-inspired default theme.
- Theme: swappable via `data-theme` on `<html>`; default in `web/src/styles/themes/default.css`.
- Visual reference: `docs/misc/canva/`; bridge in `docs/skills/ui-frontend/ui/design-system.md`.
- Frameworks: React, TypeScript, Vite.
- Styling: Tailwind CSS and shadcn/ui.
- Component isolation: ui primitives, features, pages, and app fragments are separated.

## Implementation Expectations

- Keep placeholders minimal and structural until the React/Vite scaffold replaces the legacy Astro skeleton.
- Use `docs/platform.md` and `docs/api.md` as the source of truth.
- Do not invent backend endpoints before `docs/api.md` defines them.
- Do not extend the legacy Astro/UnoCSS skeleton.
- Call `initTheme()` at app boot; add new themes by extending `web/src/styles/themes/` and `web/src/lib/theme.ts`.

## Commands

```bash
cd web
npm install
npm run dev
npm run build
```
