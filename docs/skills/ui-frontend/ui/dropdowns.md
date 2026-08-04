# Dropdowns

Use shadcn/ui DropdownMenu, Select, and Popover components.

## When to Use

| Component | Usage |
| --- | --- |
| DropdownMenu | Action menus, context menus, user menus |
| Select | Form field with fixed options |
| Popover | Date pickers, filters, compact panels |

`cmdk` is **not installed**, so there is no shadcn `Command` component. The
closest existing pattern is the chat slash-command menu
(`web/src/features/chat/components/SlashCommandMenu.tsx`), a filtered list
rendered inline above the composer. Follow it for searchable option lists rather
than adding a dependency.

## Rules

- DropdownMenu items with destructive actions use `text-destructive` styling.
- Select fields require visible labels; use `Label` from shadcn.
- Keyboard navigation: arrow keys within menus, Enter to select, Escape to close.
- Keep menu item text concise; use icons from Lucide for common actions.
- Avoid nesting more than one level of submenu unless necessary.

## Density

Dashboard contexts use compact padding (`py-1.5 px-2` items). Settings and forms use standard padding.
