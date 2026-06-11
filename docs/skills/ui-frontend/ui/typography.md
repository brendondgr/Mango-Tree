# Typography

Use Tailwind typography utilities and shadcn text conventions. Default scale follows Canva's compressed hierarchy (weight contrast over color).

## Scale

| Role | Class / size | Weight | Usage |
| --- | --- | --- | --- |
| Page title | `text-3xl` (36px) | `font-bold` | Top-level page heading |
| Section | `text-2xl` (24px) | `font-bold` | Major sections |
| Sub-section | `text-xl` (18px) | `font-semibold` | Card titles, panels |
| Body large | `text-lg` (16px) | `font-normal` | Lede, dialog body |
| Body | `text-sm` (14px) | `font-normal` | Standard UI prose, tables, labels |
| Caption | `text-xs` (12px) | `font-medium` | Metadata, hints |
| Tag | 11px custom | `font-semibold uppercase tracking-wide` | Category chips |

## Font

```css
font-family: var(--font-sans);
/* "Canva Sans", "YS Text", system-ui, -apple-system, sans-serif */
```

Canva Sans is not bundled; fallbacks apply. Code and IDs use `font-mono text-sm`.

## Rules

- Page titles use `text-3xl font-bold text-foreground tracking-tight`.
- Section headings use `text-2xl font-bold text-foreground`.
- Card titles use `text-xl font-semibold text-foreground leading-tight`.
- Secondary text uses `text-sm text-muted-foreground`.
- Line height: `leading-relaxed` for markdown; `leading-normal` or `leading-tight` for UI controls.
- Hierarchy via weight (800→700→600→400), not color alone.
- Do not use more than three size levels on a single screen.

## Markdown Content

Agent output and notes render via react-markdown with remark-gfm. Code blocks use rehype-highlight with a theme matching `--primary` accent colors.
