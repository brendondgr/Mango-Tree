# Colors

Use the Mango theme via Tailwind and shadcn CSS variables defined in `web/src/styles/globals.css`.

## Semantic Tokens

| Token | HSL | Hex reference | Usage |
| --- | --- | --- | --- |
| background | 210 33% 97% | #F4F6F9 | Page background |
| foreground | 234 32% 22% | #25284B | Primary text |
| card | 0 0% 100% | #FFFFFF | Elevated surfaces |
| primary | 209 63% 34% | #20588D | Primary actions, links |
| secondary | 196 67% 92% | #EAF6FB | Secondary backgrounds |
| accent | 194 65% 55% | #40B1D7 | Highlights, active states |
| muted-foreground | 215 16% 47% | #64748B | Secondary text |
| border | 204 38% 89% | #D6E4F0 | Dividers, borders |
| destructive | 0 72% 51% | #dc2626 | Errors, destructive actions |
| success | 160 84% 39% | #10b981 | Success states |

## Rules

- Use semantic tokens (`bg-background`, `text-foreground`, `border-border`) rather than raw hex values.
- Status colors must include text labels or icons; do not rely on color alone.
- Overlay backgrounds use `bg-primary/85` with `text-primary-foreground`.
- Table headers use `bg-secondary`; alternating rows use `bg-muted/50`.

## shadcn Mapping

Configure in `components.json` and `tailwind.config.ts`. Extend the default shadcn theme with Mango token values above.
