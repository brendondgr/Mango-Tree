# Modals

Use shadcn/ui Dialog and AlertDialog components for overlays.

## When to Use

| Component | Usage |
| --- | --- |
| Dialog | Forms, detail panels, multi-step flows |
| AlertDialog | Destructive confirmations, irreversible actions |
| Sheet | Side panels for filters, settings, or context |

## Rules

- Trap focus inside open modals.
- Close on Escape unless a destructive action is in progress.
- Provide a visible close button and a clear title.
- Destructive AlertDialogs require explicit confirmation text for high-risk actions.
- Modal width: `max-w-lg` for forms, `max-w-2xl` for detail views, `max-w-4xl` for complex editors.
- Use Framer Motion for enter/exit transitions sparingly; prefer shadcn built-in animations.

## Overlay

Use `bg-primary/85` overlay per Mango theme. Content panel uses `bg-card` with `border-border`.

## Agent Output

When displaying agent responses in modals, use react-markdown with syntax highlighting for code blocks.
