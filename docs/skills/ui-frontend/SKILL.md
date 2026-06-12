---
name: ui-frontend
description: Use this skill when designing or implementing Mango Tree frontend UI components, routes, dashboards, layouts, accessibility, visual tokens, responsive behavior, or interactive React elements with shadcn/ui and Tailwind.
---

# Mango Tree Frontend UI Skill

Mango Tree's interface should feel approachable, scannable, and operational. It is a control surface for a local agent platform, so prioritize clear status, organized information, and restrained polish. Visual language is Canva-inspired (white canvas, purple accent, soft geometry) applied to dashboard surfaces — not marketing pages.

## Stack

- React and TypeScript with Vite.
- TanStack Router and TanStack Query.
- Zustand for UI state.
- Tailwind CSS and shadcn/ui for components.
- Radix UI for accessible primitives.
- Framer Motion for transitions.

## Theme System

Themes are swappable at runtime via `data-theme` on `<html>`. Components consume shadcn semantic tokens only (`bg-background`, `text-primary`, `border-border`).

- Theme families: **Mango** (Canva default/dark), **Blue** (generic blue-gray), **FSU** (garnet/gold), **PULSE** (lab navy/cyan). Each family has light and dark compound ids (e.g. `fsu-dark`, `pulse-light`).
- Registry and metadata: `web/src/lib/theme.ts`, `web/src/lib/themeMeta.ts` (`THEME_META`, `THEME_GROUPS`, family pairing).
- Entry point: `web/src/styles/globals.css`.
- Runtime swapper: `initTheme`, `setTheme`, `toggleThemeInFamily` (chat menu toggles within the active family).
- Brand references: `docs/misc/canva/` (Mango), `docs/misc/fsu/tokens.md`, `docs/misc/pulse/tokens.md`.

**Accent presets** (`web/src/lib/colorPalette.ts`) overlay `primary` / `accent` / `ring` on **Mango** themes only. Branded families set `selfContained: true` in `THEME_META`; selecting them clears palette overrides.

Add a new tone by creating `{id}.css` under `web/src/styles/themes/` with the full shadcn + extended token contract (`REQUIRED_THEME_CSS_VARS` in `themeMeta.ts`), importing it in `globals.css`, registering the id in `THEMES`, and adding metadata to `THEME_META_LIST`. Run `npm test` in `web/` — `themeContract.test.ts` validates token completeness.

Reserve gradient CTAs for focal moments on Mango; branded themes use their own `--brand-gradient` definitions.

## Design Rules

- Build actual application surfaces, not marketing pages.
- Use dashboard-appropriate density and predictable navigation.
- Use shadcn Card only for repeated items, modals, or framed tools.
- Keep page sections unframed and full-width with constrained inner content.
- Use Lucide icons for common commands.
- Keep focus states visible and keyboard navigation clear.
- Meet WCAG 2.2 AA contrast for text and non-text UI.
- Do not rely on color alone for status; pair color with text or iconography.
- Keep layouts stable across mobile and desktop.
- Prefer shadcn/ui primitives over custom components when a primitive exists.
- Do not hardcode hex or HSL in components; use theme tokens.

## Component Organization

- Shared UI primitives: `web/src/components/ui/` (shadcn).
- Feature modules: `web/src/features/`.
- App-specific fragments: `utils/apps/{app}/frontend/`.

See `docs/skills/ui-frontend/ui/design-system.md` for the theme bridge, then `ui/` for token-level guidance on colors, buttons, modals, typography, and related patterns.
