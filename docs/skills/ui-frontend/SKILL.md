---
name: ui-frontend
description: Use this skill when designing or implementing Mango Tree frontend UI components, routes, dashboards, layouts, accessibility, visual tokens, responsive behavior, or interactive React elements with shadcn/ui and Tailwind.
---

# Mango Tree Frontend UI Skill

Mango Tree's interface should feel professional, calm, operational, and precise. It is a control surface for a local agent platform, so prioritize scanability, clear status, dense but organized information, and restrained visual polish.

## Stack

- React and TypeScript with Vite.
- TanStack Router and TanStack Query.
- Zustand for UI state.
- Tailwind CSS and shadcn/ui for components.
- Radix UI for accessible primitives.
- Framer Motion for transitions.

## Mango Theme

The Mango theme derives from the Pulse Light palette, mapped to shadcn/Tailwind CSS variables:

```css
:root {
  --background: 210 33% 97%;        /* #F4F6F9 */
  --foreground: 234 32% 22%;        /* #25284B */
  --card: 0 0% 100%;                /* #FFFFFF */
  --card-foreground: 234 32% 22%;
  --primary: 209 63% 34%;           /* #20588D */
  --primary-foreground: 0 0% 100%;
  --secondary: 196 67% 92%;         /* #EAF6FB */
  --secondary-foreground: 234 32% 22%;
  --muted: 210 33% 97%;
  --muted-foreground: 215 16% 47%;  /* #64748B */
  --accent: 194 65% 55%;            /* #40B1D7 */
  --accent-foreground: 0 0% 100%;
  --destructive: 0 72% 51%;         /* #dc2626 */
  --border: 204 38% 89%;            /* #D6E4F0 */
  --ring: 209 63% 34%;
  --success: 160 84% 39%;           /* #10b981 */
}
```

Apply via `web/src/styles/globals.css` and shadcn theme configuration.

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

## Component Organization

- Shared UI primitives: `web/src/components/ui/` (shadcn).
- Feature modules: `web/src/features/`.
- App-specific fragments: `utils/apps/{app}/frontend/`.

See `docs/skills/ui-frontend/ui/` for token-level guidance on colors, buttons, modals, typography, and related patterns.
