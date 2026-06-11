# Motion

Use Framer Motion for purposeful transitions; avoid decorative animation.

## Allowed Uses

- Page transitions within the SPA shell (subtle fade/slide).
- Modal and sheet enter/exit.
- Command palette open/close.
- Agent chat message appearance (fade-in, stagger for batches).
- Loading skeleton pulse (prefer shadcn Skeleton component).

## Rules

- Duration: 150–250ms for UI transitions; 300ms max for page transitions.
- Respect `prefers-reduced-motion`: disable or simplify animations when set.
- Do not animate layout-critical properties (width, height) unless using layout animations intentionally.
- Loading indicators use CSS spin on Loader2; avoid custom spinners.
- Chart animations (Recharts) use default enter animations at reduced duration.

## Prohibited

- Bouncing or elastic effects on standard UI controls.
- Parallax or scroll-driven animation in dashboard views.
- Animation that delays user interaction.
