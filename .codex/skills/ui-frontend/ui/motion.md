# Motion

Use Framer Motion for purposeful transitions; avoid decorative animation. Durations and easing follow the active theme (`--motion-fast`, `--motion-base`, `--ease-standard`).

## Allowed Uses

- Page transitions within the SPA shell (subtle fade/slide).
- Modal and sheet enter/exit.
- Command palette open/close.
- Agent chat message appearance (fade-in, stagger for batches).
- Loading skeleton pulse (prefer shadcn Skeleton component).
- Card hover lift: `translateY(-2px)` + shadow grow.

## Rules

- Duration: 180ms (`--motion-fast`) for hover and micro-interactions; 280ms (`--motion-base`) for menus and dialogs; 420ms max for sidebar collapse.
- Easing: `var(--ease-standard)` — `cubic-bezier(0.4, 0, 0.2, 1)`.
- Respect `prefers-reduced-motion`: disable or simplify animations when set.
- Do not animate layout-critical properties (width, height) unless using layout animations intentionally.
- Loading indicators use CSS spin on Loader2; avoid custom spinners.
- Chart animations (Recharts) use default enter animations at reduced duration.

## Prohibited

- Bouncing or elastic effects on standard UI controls.
- Parallax or scroll-driven animation in dashboard views.
- Animation that delays user interaction.
- Animated brand gradients (gradient is static per Canva guardrails).
