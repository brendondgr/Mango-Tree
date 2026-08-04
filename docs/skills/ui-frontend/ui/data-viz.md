# Data Visualization

**No charting library is installed.** There is no Recharts, no D3, no Chart.js.
Existing charts — for example the Time Keeper dashboard
(`utils/apps/timekeeper/frontend/components/DashboardView.tsx`) — are built from
plain CSS: proportional bars sized with a percentage width and coloured from
theme tokens.

Build charts the same way, or add the dependency deliberately and update this
document. Do not write code that imports a chart library that is not in
`web/package.json`.

## Approach

| Need | Build with |
| --- | --- |
| Proportional comparison | Flex row of divs, each `width: {pct}%`, coloured by category token |
| Time series | A row of bars keyed by bucket, height as a percentage of the max |
| Proportional breakdown | Stacked bar, or `conic-gradient` for a ring |
| Single scalar | A stat card, never a chart |

## Colors

- Primary series: `hsl(var(--primary))` (`#7d2ae8` in the default theme).
- Secondary series: `hsl(var(--accent))` (`#00c4cc`).
- Additional series: the category tokens `--category-coral`, `--category-mint`,
  `--category-sky`, `--category-lavender`, `--category-tangerine`.
- Grid or track: `hsl(var(--border))`.
- Axis and tick text: `hsl(var(--muted-foreground))`.
- Tooltip surface: `hsl(var(--card))` with `border-border`.

Never hardcode a hex value — a chart drawn in raw hex breaks in seven of the
eight themes. Category tokens are the one place distinct colors are correct;
chrome uses theme tokens.

## Rules

- Label axes and give every chart a title.
- Show a legend when more than one series is present.
- An empty state is a message and optional action, not a blank plotting area.
- Charts must resize with their container — percentage widths, not fixed pixels.
- Do not chart a single scalar; use a stat card.

## Stat Cards

shadcn `Card` with a large value (`text-2xl font-semibold`) and a muted label
(`text-sm text-muted-foreground`). Trend indicators use success/destructive
colors with arrow icons.

## Tables

shadcn `Table`. Sortable columns, pagination, and row selection for bulk
actions. Header background uses `bg-secondary`.
