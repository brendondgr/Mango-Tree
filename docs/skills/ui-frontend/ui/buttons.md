# Buttons

Use shadcn/ui Button variants with Mango theme tokens.

## Variants

| Variant | Usage |
| --- | --- |
| default | Primary actions (submit, confirm, create) |
| secondary | Secondary actions (cancel adjacent to primary) |
| outline | Tertiary actions, toolbar buttons |
| ghost | Icon-only or low-emphasis actions |
| destructive | Delete, remove, irreversible actions |
| link | Inline navigation within content |

## Rules

- One primary button per action group.
- Destructive actions require confirmation via Dialog or AlertDialog.
- Icon buttons use `size="icon"` with an accessible `aria-label`.
- Disabled buttons use reduced opacity; do not remove from tab order unless truly inapplicable.
- Loading states show a spinner and disable interaction; preserve button width to avoid layout shift.

## Sizing

- Default height: `h-9` (36px) for standard actions.
- Compact height: `h-8` (32px) for dense toolbars and table rows.
- Large height: `h-10` (40px) for prominent call-to-action in empty states.

## Command Palette

Command palette actions use cmdk items styled consistently with ghost buttons. Keyboard shortcuts display in muted text on the right.
