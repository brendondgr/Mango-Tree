# Typography

Use Tailwind typography utilities and shadcn text conventions.

## Scale

| Class | Size | Usage |
| --- | --- | --- |
| text-xs | 12px | Metadata, timestamps, badges |
| text-sm | 14px | Body text, table cells, form labels |
| text-base | 16px | Default body, dialog content |
| text-lg | 18px | Section headings within pages |
| text-xl | 20px | Page titles |
| text-2xl | 24px | Dashboard headings |

## Font

Use the system font stack via Tailwind defaults, or Inter if configured in the Vite scaffold.

## Rules

- Page titles use `text-xl font-semibold text-foreground`.
- Section headings use `text-lg font-medium text-foreground`.
- Secondary text uses `text-sm text-muted-foreground`.
- Monospace for code, IDs, and paths: `font-mono text-sm`.
- Line height: `leading-relaxed` for markdown content; `leading-normal` for UI controls.
- Do not use more than three size levels on a single screen.

## Markdown Content

Agent output and notes render via react-markdown with remark-gfm. Code blocks use rehype-highlight with a theme matching Mango accent colors.
