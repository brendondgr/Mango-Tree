import { useMemo, useState, type ReactNode } from "react";
import { BarChart3 } from "lucide-react";

import {
  SegmentedControl,
  type Segment,
} from "@/components/app-shell/SegmentedControl";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { StatChart } from "@exercise/components/StatChart";
import { useHistory, useWorkouts } from "@exercise/hooks/useExercise";
import { CARD } from "@exercise/utils/ui";
import {
  type Aggregation,
  type GraphType,
  type Scope,
  buildSeries,
  countByTypeScope,
  defaultDateRange,
  displayDistance,
  distanceByTypeScope,
  filterByRange,
  getBuckets,
  hoursByTypeScope,
} from "@exercise/utils/stats";

const SCOPES: Array<{ key: Scope; label: string }> = [
  { key: "all", label: "All Time" },
  { key: "year", label: "This Year" },
  { key: "month", label: "This Month" },
  { key: "week", label: "This Week" },
];

const AGGREGATIONS: Segment<Aggregation>[] = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const GRAPH_TYPES: Segment<GraphType>[] = [
  { value: "time", label: "Time" },
  { value: "volume", label: "Volume" },
  { value: "distance", label: "Distance" },
];

type Units = "imperial" | "metric";
const UNITS: Segment<Units>[] = [
  { value: "imperial", label: "Imperial" },
  { value: "metric", label: "Metric" },
];

function toInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * One metric line inside a scope card: total, then the two activity splits.
 *
 * The old layout put four scopes on one fixed five-column grid, which gave each
 * scope 34px of width on a phone and spilled the numbers across each other and
 * past the card. Numbers now wrap within a card that is itself the grid unit,
 * so nothing has to fit a column narrower than its content.
 */
function MetricRow({
  label,
  unit,
  total,
  run,
  walk,
  dim,
}: {
  label: string;
  unit?: string;
  total: string;
  run: string;
  walk: string;
  dim?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <p className="text-xs font-medium text-muted-foreground">
        {label}
        {unit ? <span className="ml-1 opacity-70">({unit})</span> : null}
      </p>
      <p className="flex items-baseline gap-1 text-lg font-bold tabular-nums">
        <span className={cn(dim ? "text-muted-foreground" : "text-foreground")}>
          {total}
        </span>
        <span aria-hidden className="text-sm font-normal text-muted-foreground">
          /
        </span>
        <span className="exercise-fg exercise-c-run">{run}</span>
        <span aria-hidden className="text-sm font-normal text-muted-foreground">
          /
        </span>
        <span className="exercise-fg exercise-c-walk">{walk}</span>
      </p>
    </div>
  );
}

function ControlGroup({ children }: { children: ReactNode }) {
  return <div className="min-w-0 grow basis-56 space-y-1.5">{children}</div>;
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 @[34rem]:grid-cols-2 @[64rem]:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-[var(--radius-lg)]" />
        ))}
      </div>
      <Skeleton className="h-28 rounded-[var(--radius-lg)]" />
      <Skeleton className="h-80 rounded-[var(--radius-lg)]" />
    </div>
  );
}

export function DashboardView() {
  const history = useHistory();
  const workouts = useWorkouts();
  const logs = useMemo(() => history.data ?? [], [history.data]);

  const [aggregation, setAggregation] = useState<Aggregation>("weekly");
  const [graphType, setGraphType] = useState<GraphType>("time");
  const [units, setUnits] = useState<Units>("imperial");
  const [range, setRange] = useState(() => defaultDateRange("weekly"));

  const useMetric = units === "metric";

  const onAggregation = (agg: Aggregation) => {
    setAggregation(agg);
    setRange(defaultDateRange(agg));
  };

  const buckets = useMemo(
    () => getBuckets(aggregation, range.start, range.end),
    [aggregation, range],
  );
  const filtered = useMemo(
    () => filterByRange(logs, range.start, range.end),
    [logs, range],
  );
  const series = useMemo(
    () => buildSeries(graphType, filtered, buckets, useMetric),
    [graphType, filtered, buckets, useMetric],
  );

  const distUnit = useMetric ? "km" : "mi";
  const volUnit = useMetric ? "kg" : "lbs";
  const chartUnit =
    graphType === "time" ? "hrs" : graphType === "volume" ? volUnit : distUnit;

  const summary = useMemo(() => {
    const totals = series.map((s) => s.values.reduce((a, b) => a + b, 0));
    const grand = totals.reduce((a, b) => a + b, 0);
    const avg = buckets.length ? grand / buckets.length : 0;
    return { totals, grand, avg };
  }, [series, buckets.length]);

  const fmt = (v: number) =>
    Math.abs(v) >= 1000
      ? v.toLocaleString(undefined, { maximumFractionDigits: 0 })
      : v.toFixed(1);

  return (
    <AsyncBoundary
      loading={history.isLoading || workouts.isLoading}
      error={history.error ?? workouts.error}
      onRetry={() => {
        void history.refetch();
        void workouts.refetch();
      }}
      label="your dashboard"
      skeleton={<DashboardSkeleton />}
      className="flex flex-col gap-4 @[48rem]:gap-6"
    >
      {/* Overview — one card per scope, so no column is ever narrower than
          the number it has to hold. */}
      <section aria-labelledby="ex-overview" className="flex flex-col gap-3">
        <h3 id="ex-overview" className="sr-only">
          Overview totals
        </h3>
        <div className="grid gap-3 @[34rem]:grid-cols-2 @[64rem]:grid-cols-4">
          {SCOPES.map((scope, i) => {
            const runDist = displayDistance(
              distanceByTypeScope(logs, "run", scope.key),
              useMetric,
            );
            const walkDist = displayDistance(
              distanceByTypeScope(logs, "walk", scope.key),
              useMetric,
            );
            return (
              <article
                key={scope.key}
                data-enter
                style={{ "--i": i } as never}
                className={cn(CARD, "flex flex-col gap-2.5 p-4")}
              >
                <h4 className="text-xs font-semibold uppercase tracking-wider text-primary-emphasis">
                  {scope.label}
                </h4>
                <MetricRow
                  label="Activities"
                  total={String(countByTypeScope(logs, "all", scope.key))}
                  run={String(countByTypeScope(logs, "run", scope.key))}
                  walk={String(countByTypeScope(logs, "walk", scope.key))}
                />
                <MetricRow
                  label="Time"
                  unit="hrs"
                  total={hoursByTypeScope(logs, "all", scope.key).toFixed(1)}
                  run={hoursByTypeScope(logs, "run", scope.key).toFixed(1)}
                  walk={hoursByTypeScope(logs, "walk", scope.key).toFixed(1)}
                />
                <MetricRow
                  label="Distance"
                  unit={distUnit}
                  dim
                  total={(runDist + walkDist).toFixed(1)}
                  run={runDist.toFixed(1)}
                  walk={walkDist.toFixed(1)}
                />
              </article>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Each figure reads total /{" "}
          <span className="exercise-fg exercise-c-run font-semibold">run</span> /{" "}
          <span className="exercise-fg exercise-c-walk font-semibold">walk</span>.
        </p>
      </section>

      {/* Controls */}
      <section
        aria-label="Chart controls"
        className={cn(CARD, "flex flex-wrap gap-4 p-4")}
      >
        <div className="min-w-0 grow basis-72 space-y-1.5">
          <p className="text-sm font-medium text-foreground">Date range</p>
          <div className="flex flex-wrap gap-2">
            <Field label="Start date" className="min-w-0 grow basis-36">
              <Input
                type="date"
                aria-label="Range start date"
                value={toInput(range.start)}
                onChange={(e) =>
                  setRange((r) => ({
                    ...r,
                    start: new Date(`${e.target.value}T12:00:00`),
                  }))
                }
              />
            </Field>
            <Field label="End date" className="min-w-0 grow basis-36">
              <Input
                type="date"
                aria-label="Range end date"
                value={toInput(range.end)}
                onChange={(e) =>
                  setRange((r) => ({
                    ...r,
                    end: new Date(`${e.target.value}T12:00:00`),
                  }))
                }
              />
            </Field>
          </div>
        </div>

        <ControlGroup>
          <p className="text-sm font-medium text-foreground">Aggregation</p>
          <SegmentedControl
            segments={AGGREGATIONS}
            value={aggregation}
            onValueChange={onAggregation}
            label="Aggregation"
          />
        </ControlGroup>

        <ControlGroup>
          <p className="text-sm font-medium text-foreground">Metric</p>
          <SegmentedControl
            segments={GRAPH_TYPES}
            value={graphType}
            onValueChange={setGraphType}
            label="Chart metric"
          />
        </ControlGroup>

        <ControlGroup>
          <p className="text-sm font-medium text-foreground">Units</p>
          <SegmentedControl
            segments={UNITS}
            value={units}
            onValueChange={setUnits}
            label="Units"
          />
        </ControlGroup>
      </section>

      {/* Chart + statistics */}
      <section className="grid gap-4 @[62rem]:grid-cols-[minmax(0,1fr)_17rem] @[48rem]:gap-6">
        <div className={cn(CARD, "min-w-0 p-4")}>
          {filtered.length === 0 || buckets.length === 0 ? (
            <EmptyState
              compact
              icon={BarChart3}
              title="No data for this range"
              description="Log a session, or widen the date range above."
            />
          ) : (
            <StatChart
              labels={buckets.map((b) => b.label)}
              series={series}
              unit={chartUnit}
              formatValue={fmt}
            />
          )}
        </div>

        <div className={cn(CARD, "h-fit p-4")}>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Statistics
          </h3>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No data in the selected range.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {fmt(summary.grand)}{" "}
                  <span className="text-base font-medium text-muted-foreground">
                    {chartUnit}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Average per {aggregation === "weekly" ? "week" : "month"}
                </p>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {fmt(summary.avg)}{" "}
                  <span className="text-base font-medium text-muted-foreground">
                    {chartUnit}
                  </span>
                </p>
              </div>
              {series.length > 1 && (
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                  {series.map((s, i) => (
                    <div key={s.key}>
                      <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span aria-hidden className={cn("exercise-dot", s.colorClass)} />
                        {s.label}
                      </p>
                      <p
                        className={cn(
                          "exercise-fg text-lg font-bold tabular-nums",
                          s.colorClass,
                        )}
                      >
                        {fmt(summary.totals[i])}
                        <span className="ml-1 text-sm font-medium text-muted-foreground">
                          {chartUnit}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </AsyncBoundary>
  );
}
