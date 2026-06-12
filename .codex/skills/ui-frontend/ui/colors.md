# Colors

Use shadcn semantic tokens from the active theme (`web/src/styles/themes/{name}.css`). Default theme values are Canva-inspired; see `design-system.md` for the full bridge and `docs/misc/canva/tokens.css` for canonical hex names.

## Semantic Tokens (default theme)

| Token | HSL | Hex reference | Usage |
| --- | --- | --- | --- |
| background | 0 0% 100% | #ffffff | Page canvas |
| foreground | 210 24% 7% | #0e1318 | Primary text |
| card | 0 0% 100% | #ffffff | Elevated surfaces |
| primary | 271 79% 54% | #7d2ae8 | Primary actions, links, focus ring |
| secondary | 220 14% 96% | #f4f5f7 | Section breaks, table headers |
| accent | 183 100% 40% | #00c4cc | Highlights, secondary emphasis |
| muted-foreground | 210 5% 39% | #5f6368 | Captions, secondary text |
| border | 210 8% 89% | #e1e3e6 | Dividers, input borders |
| destructive | 0 100% 67% | #ff5757 | Errors, destructive actions |
| success | 168 100% 36% | #00b894 | Success states |

Extended theme tokens (`--brand-gradient`, `--category-*`, `--surface-inset`) are defined per theme file for tags, badges, and gradient CTAs.

## Rules

- Use semantic Tailwind classes (`bg-background`, `text-foreground`, `border-border`) — never raw hex in components.
- Status colors must include text labels or icons; do not rely on color alone.
- Overlay backgrounds use `bg-foreground/60` or `bg-primary/85`; content panel uses `bg-card`.
- Table headers use `bg-secondary`; alternating rows use `bg-muted/50`.
- Category accent colors (`--category-coral`, etc.) belong in tags and metadata only.

## shadcn Mapping

Configure in `components.json` and `tailwind.config.ts`. Theme CSS files supply HSL values; Tailwind maps them via `hsl(var(--primary))` pattern. When adding a theme, copy the variable contract from `default.css`.
