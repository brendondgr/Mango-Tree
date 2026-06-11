# Geometry

Spacing, radius, and layout conventions for the Mango dashboard.

## Spacing

- Page padding: `p-6` (24px) on desktop; `p-4` (16px) on mobile.
- Section gap: `gap-6` between major sections; `gap-4` within sections.
- Card internal padding: `p-4` or `p-6` depending on content density.
- Form field gap: `gap-4` between fields; `gap-2` between label and input.

## Border Radius

- Default (buttons, inputs): `rounded-md` (6px) via shadcn defaults.
- Cards: `rounded-lg` (8px).
- Modals and sheets: `rounded-lg` on top corners for sheets; `rounded-lg` all corners for dialogs.

## Layout

- Sidebar width: 240px collapsed to 64px icon-only mode.
- Main content max-width: full width with inner constraint `max-w-7xl mx-auto` for data-heavy pages.
- Split panels (chat + workspace): 40/60 or 50/50 with resizable handles when needed.
- Tables are full-width within their container; horizontal scroll on mobile.

## Grid

- Dashboard cards: responsive grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.
- Form layouts: single column on mobile; two columns on desktop for short fields.

## Shadows

Use shadcn default shadow tokens. Elevated surfaces (dropdowns, popovers) use `shadow-md`. Cards use `shadow-sm` or border-only for flat dashboard aesthetic.
