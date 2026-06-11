# Data Visualization

Use Recharts for analytics and dashboard charts. Colors come from the active theme tokens.

## Chart Types

| Type | Usage |
| --- | --- |
| LineChart | Time series, agent activity, job throughput |
| BarChart | Comparisons, category counts |
| AreaChart | Cumulative metrics, memory usage |
| PieChart | Proportional breakdowns (use sparingly) |

## Theming

- Primary series: `hsl(var(--primary))` (#7d2ae8 default).
- Secondary series: `hsl(var(--accent))` (#00c4cc default).
- Additional series: category tokens (`--category-coral`, `--category-mint`, `--category-sky`, `--category-lavender`, `--category-tangerine`).
- Grid lines: `hsl(var(--border))`.
- Axis text: `hsl(var(--muted-foreground))`.
- Tooltip background: `hsl(var(--card))` with `border-border`.

## Rules

- Always label axes and provide chart titles.
- Include a legend when more than one series is present.
- Empty states show a message and optional action, not a blank chart area.
- Responsive containers use `ResponsiveContainer` with `width="100%"`.
- Do not use charts for single scalar values; use stat cards instead.

## Stat Cards

Use shadcn Card with large value text (`text-2xl font-semibold`) and muted label (`text-sm text-muted-foreground`). Trend indicators use success/destructive colors with arrow icons.

## Tables

Use shadcn Table for tabular data. Sortable columns, pagination, and row selection for bulk actions. Header background uses `bg-secondary`.
