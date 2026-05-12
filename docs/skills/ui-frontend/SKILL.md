---
name: ui-frontend
description: Use this skill when designing or implementing Mango Tree frontend UI components, routes, dashboards, layouts, accessibility, visual tokens, responsive behavior, or interactive Astro/Svelte/React elements.
---

# Mango Tree Frontend UI Skill

Mango Tree's interface should feel professional, calm, operational, and precise. It is a control surface for a local agent runtime, so prioritize scanability, clear status, dense but organized information, and restrained visual polish.

## Stack

- Astro for routes and page shell.
- Svelte for lightweight interactive widgets.
- React for UI islands that benefit from the React ecosystem.
- UnoCSS for utilities.
- CSS variables for theme tokens.

## Pulse Light Theme

```css
.theme-pulse-light {
  --bg-color: #F4F6F9;
  --bg-secondary: #EAF6FB;
  --surface-color: #FFFFFF;
  --text-primary: #25284B;
  --text-secondary: #475569;
  --text-muted: #64748B;
  --accent: #20588D;
  --accent-light: #40B1D7;
  --accent-dark: #153A5D;
  --border-color: #D6E4F0;
  --overlay-bg: rgba(32, 88, 141, 0.85);
  --overlay-text: #FFFFFF;
  --shadow-color: rgba(37, 40, 75, 0.1);
  --table-header-bg: #D6E4F0;
  --table-row-alt: #F4F6F9;
  --status-success: #10b981;
  --status-danger: #dc2626;
}
```

## Design Rules

- Build actual application surfaces, not marketing pages.
- Use dashboard-appropriate density and predictable navigation.
- Use cards only for repeated items, modals, or framed tools.
- Keep page sections unframed and full-width with constrained inner content.
- Use icons for common commands when available.
- Keep focus states visible and keyboard navigation clear.
- Meet WCAG 2.2 AA contrast for text and non-text UI.
- Do not rely on color alone for status; pair color with text or iconography.
- Keep layouts stable across mobile and desktop.
