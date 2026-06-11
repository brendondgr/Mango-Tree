# Geometry

Spacing, radius, and layout conventions for the Mango dashboard. Radius and spacing follow the Canva-inspired default theme; layout dimensions are app-specific.

## Spacing

Base unit: 4px. Scale: 4, 8, 12, 16, 24, 32, 48.

- Page padding: `p-8` (32px) on desktop; `p-4` (16px) on mobile.
- Section gap: `gap-6` (24px) between major sections; `gap-4` within sections.
- Card internal padding: `p-4` or `p-6` depending on content density.
- Form field gap: `gap-4` between fields; `gap-2` between label and input.
- Card grid gap: `gap-4` mobile, `gap-6` desktop.

## Border Radius

Theme tokens: `--radius-sm` (8px), `--radius-md` (12px), `--radius-lg` (16px), `--radius-pill` (9999px).

- Buttons and inputs: `rounded-[var(--radius-sm)]` or Tailwind `rounded-lg` mapped to 8px.
- Cards and tiles: `rounded-[var(--radius-md)]` (12px).
- Panels and dialogs: `rounded-[var(--radius-lg)]` (16px).
- Chips and tags: `rounded-full` / pill.

## Layout

- Sidebar width: 240px collapsed to 64px icon-only mode (editor-style apps may use 320px / 56px per Canva fixture).
- Main content max-width: `max-w-[1320px] mx-auto` with 32px gutter on desktop.
- Split panels (chat + workspace): 40/60 or 50/50 with resizable handles when needed.
- Tables are full-width within their container; horizontal scroll on mobile.

## Grid

- Dashboard cards: responsive grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.
- Form layouts: single column on mobile; two columns on desktop for short fields.

## Shadows

- Resting cards: `var(--shadow-raised)` or border-only for flat sections.
- Hover lift: `translateY(-2px)` + `var(--shadow-card-hover)` over `var(--motion-fast)`.
- Dropdowns and popovers: `shadow-md`.
