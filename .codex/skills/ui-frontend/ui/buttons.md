# Buttons

Use shadcn/ui Button variants with theme semantic tokens.

## Variants

| Variant | Usage |
| --- | --- |
| default | Primary actions — solid `--primary` purple |
| secondary | Secondary actions (cancel adjacent to primary) |
| outline | Tertiary actions, toolbar buttons |
| ghost | Icon-only or low-emphasis actions |
| destructive | Delete, remove, irreversible actions |
| link | Inline navigation within content |

## Brand Gradient (focal CTAs only)

For empty states, onboarding, or a single hero CTA per view, add a `gradient` variant:

- Background: `var(--brand-gradient)` (`linear-gradient(135deg, #7d2ae8, #00c4cc)`)
- Text: `text-primary-foreground`
- Shadow: `0 2px 8px rgba(125, 42, 232, 0.2)`; hover shadow grows to `0 4px 14px rgba(125, 42, 232, 0.3)`
- Radius: `var(--radius-sm)` (8px)
- Do not use gradient for standard form submits or toolbar actions.

Solid purple primary: background `hsl(var(--primary))`, hover `hsl(var(--primary-hover))`.

## Rules

- One primary button per action group.
- Destructive actions require confirmation via Dialog or AlertDialog.
- Icon buttons use `size="icon"` with an accessible `aria-label`.
- Disabled buttons use reduced opacity; do not remove from tab order unless truly inapplicable.
- Loading states show a spinner and disable interaction; preserve button width to avoid layout shift.

## Sizing

- Default: padding 12px 20px, height ~40px (`h-10`).
- Compact: `h-8` (32px) for dense toolbars and table rows.
- Large: `h-11` for prominent empty-state CTAs.

## Command Palette

Command palette actions use cmdk items styled consistently with ghost buttons. Keyboard shortcuts display in muted text on the right.
