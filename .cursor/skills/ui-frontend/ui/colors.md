# Colors

Use shadcn semantic tokens from the active theme (`web/src/styles/themes/{name}.css`). Default theme values are Canva-inspired with layered off-white surfaces; see `design-system.md` for the full bridge and `docs/misc/canva/tokens.css` for canonical Canva hex names.

## Semantic Tokens (default / light theme)

| Token | HSL | Hex reference | Usage |
| --- | --- | --- | --- |
| background | 40 14% 96% | #f6f4f1 | Page canvas |
| foreground | 210 20% 10% | #141a1f | Primary text |
| card | 40 10% 99% | #fcfbfa | Elevated surfaces |
| primary | 271 79% 54% | #7d2ae8 | Primary actions, links, focus ring |
| secondary | 40 8% 92% | #ebe9e5 | Section breaks, table headers |
| muted | 220 10% 90% | #e3e5e8 | Chips, code blocks, inset fills |
| accent | 183 100% 40% | #00c4cc | Highlights, secondary emphasis |
| muted-foreground | 210 6% 42% | #656b72 | Captions, secondary text |
| border | 40 7% 84% | #d9d6d1 | Dividers, input borders |
| destructive | 0 100% 67% | #ff5757 | Errors, destructive actions |
| success | 168 100% 36% | #00b894 | Success states |

## Semantic Tokens (dark theme)

| Token | HSL | Hex reference | Usage |
| --- | --- | --- | --- |
| background | 220 14% 13% | #1d2028 | Page canvas |
| foreground | 40 8% 88% | #e2e0dc | Primary text |
| card | 220 12% 17% | #262a33 | Elevated surfaces |
| secondary | 220 10% 21% | #2f333d | Section breaks, secondary buttons |
| muted | 220 9% 24% | #383c47 | Chips, code blocks, inset fills |
| border | 220 8% 28% | #424652 | Dividers, input borders |

Extended theme tokens (`--brand-gradient`, `--category-*`, `--surface-inset`) are defined per theme file for tags, badges, and gradient CTAs.

## Rules

- Use semantic Tailwind classes (`bg-background`, `text-foreground`, `border-border`) — never raw hex in components.
- Status colors must include text labels or icons; do not rely on color alone.
- Overlay backgrounds use `bg-foreground/60` or `bg-primary/85`; content panel uses `bg-card`.
- Table headers use `bg-secondary`; alternating rows use `bg-muted/50`.
- Category accent colors (`--category-coral`, etc.) belong in tags and metadata only.

## shadcn Mapping

Configure in `components.json` and `tailwind.config.ts`. Theme CSS files supply HSL values; Tailwind maps them via `hsl(var(--primary))` pattern. When adding a theme, copy the variable contract from `default.css`.
