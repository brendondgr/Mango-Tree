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

- Use `docs/platform.md` and `docs/api.md` as the source of truth.
- Do not call a backend endpoint before `docs/api.md` defines it.
- Do not import a library that is not in `web/package.json`. There is no form,
  validation, charting, or command-palette library installed.
- Call `initTheme()` at app boot; add new themes by extending
  `web/src/styles/themes/` and `web/src/lib/theme.ts`. A new theme must define
  every token in `web/src/lib/themeMeta.ts` or `themeContract.test.ts` fails.
- Style from theme tokens, never raw hex. Chrome uses semantic tokens; distinct
  colors are for data categories only.

## Commands

```bash
cd web && npm install
```

```bash
cd web && npm run dev
```

```bash
cd web && npm test
```

```bash
cd web && npm run build
```
