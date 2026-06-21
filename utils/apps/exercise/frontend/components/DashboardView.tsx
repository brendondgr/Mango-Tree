import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { StatChart } from "@exercise/components/StatChart";
import { useHistory, useWorkouts } from "@exercise/hooks/useExercise";
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

function toInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function Triplet({ total, run, walk, dim }: { total: string; run: string; walk: string; dim?: boolean }) {
  return (
    <div className="flex items-baseline gap-1 text-xl font-bold">
      <span className={cn(dim ? "text-muted-foreground" : "text-foreground")}>{total}</span>
      <span className="text-sm text-muted-foreground">/</span>
      <span className="exercise-fg exercise-c-run">{run}</span>
      <span className="text-sm text-muted-foreground">/</span>
      <span className="exercise-fg exercise-c-walk">{walk}</span>
    </div>
  );
}

export function DashboardView() {
  const history = useHistory();
  const workouts = useWorkouts();
  const logs = useMemo(() => history.data ?? [], [history.data]);

  const [aggregation, setAggregation] = useState<Aggregation>("weekly");
  const [graphType, setGraphType] = useState<GraphType>("time");
  const [useMetric, setUseMetric] = useState(false);
  const [range, setRange] = useState(() => defaultDateRange("weekly"));

  const onAggregation = (agg: Aggregation) => {
    setAggregation(agg);
    setRange(defaultDateRange(agg));
  };

  const buckets = useMemo(
    () => getBuckets(aggregation, range.start, range.end),
    [aggregation, range],
  );
  const filtered = useMemo(() => filterByRange(logs, range.start, range.end), [logs, range]);
  const series = useMemo(
    () => buildSeries(graphType, filtered, buckets, useMetric),
    [graphType, filtered, buckets, useMetric],
  );

  const distUnit = useMetric ? "km" : "mi";
  const volUnit = useMetric ? "kg" : "lbs";
  const chartUnit = graphType === "time" ? "hrs" : graphType === "volume" ? volUnit : distUnit;

  const summary = useMemo(() => {
    const totals = series.map((s) => s.values.reduce((a, b) => a + b, 0));
    const grand = totals.reduce((a, b) => a + b, 0);
    const avg = buckets.length ? grand / buckets.length : 0;
    return { totals, grand, avg };
  }, [series, buckets.length]);

  if (history.isLoading || workouts.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  }
  if (history.isError) {
    return <p className="text-sm text-destructive">{(history.error as Error).message}</p>;
  }

  const fmt = (v: number) => (Math.abs(v) >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : v.toFixed(1));

  return (
    <div className="exercise-fade-in flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="exercise-gradient-text text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground">Workouts / Runs / Walks at a glance</p>
        </div>
      </header>

      {/* Overview matrix */}
      <section className="exercise-glass rounded-[var(--radius-lg)] p-5">
        <div className="grid grid-cols-[5.5rem_repeat(4,minmax(0,1fr))] items-end gap-x-4 gap-y-3">
          <div />
          {SCOPES.map((s) => (
            <p key={s.key} className="text-xs font-semibold text-muted-foreground">{s.label}</p>
          ))}

          <p className="exercise-fg exercise-c-exercise text-[0.65rem] font-bold uppercase tracking-wider">Activities</p>
          {SCOPES.map((s) => (
            <Triplet
              key={s.key}
              total={String(countByTypeScope(logs, "all", s.key))}
              run={String(countByTypeScope(logs, "run", s.key))}
              walk={String(countByTypeScope(logs, "walk", s.key))}
            />
          ))}

          <p className="exercise-fg exercise-c-exercise text-[0.65rem] font-bold uppercase tracking-wider">Time (hrs)</p>
          {SCOPES.map((s) => (
            <Triplet
              key={s.key}
              total={hoursByTypeScope(logs, "all", s.key).toFixed(1)}
              run={hoursByTypeScope(logs, "run", s.key).toFixed(1)}
              walk={hoursByTypeScope(logs, "walk", s.key).toFixed(1)}
            />
          ))}

          <p className="exercise-fg exercise-c-exercise text-[0.65rem] font-bold uppercase tracking-wider">Distance ({distUnit})</p>
          {SCOPES.map((s) => {
            const run = displayDistance(distanceByTypeScope(logs, "run", s.key), useMetric);
            const walk = displayDistance(distanceByTypeScope(logs, "walk", s.key), useMetric);
            return (
              <Triplet key={s.key} dim total={(run + walk).toFixed(1)} run={run.toFixed(1)} walk={walk.toFixed(1)} />
            );
          })}
        </div>
      </section>

      {/* Controls */}
      <section className="exercise-glass grid grid-cols-1 gap-5 rounded-[var(--radius-lg)] p-5 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">Date Range</label>
          <div className="flex gap-2">
            <input
              type="date"
              className="exercise-input min-w-0 flex-1"
              value={toInput(range.start)}
              onChange={(e) => setRange((r) => ({ ...r, start: new Date(`${e.target.value}T12:00:00`) }))}
            />
            <input
              type="date"
              className="exercise-input min-w-0 flex-1"
              value={toInput(range.end)}
              onChange={(e) => setRange((r) => ({ ...r, end: new Date(`${e.target.value}T12:00:00`) }))}
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">Aggregation</label>
          <div className="exercise-seg">
            {(["weekly", "monthly"] as Aggregation[]).map((a) => (
              <button key={a} type="button" className="exercise-seg-btn capitalize" data-active={aggregation === a} onClick={() => onAggregation(a)}>
                {a}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-foreground">Metric</label>
          <div className="exercise-seg">
            {(["time", "volume", "distance"] as GraphType[]).map((g) => (
              <button key={g} type="button" className="exercise-seg-btn capitalize" data-active={graphType === g} onClick={() => setGraphType(g)}>
                {g}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Chart + stats */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="exercise-glass rounded-[var(--radius-lg)] p-5 lg:col-span-3">
          {filtered.length === 0 || buckets.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
              No data available for this range
            </div>
          ) : (
            <StatChart labels={buckets.map((b) => b.label)} series={series} unit={chartUnit} formatValue={fmt} />
          )}
        </div>

        <div className="exercise-glass h-fit rounded-[var(--radius-lg)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Statistics</h3>
            <button
              type="button"
              className="rounded-[var(--radius-sm)] border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => setUseMetric((m) => !m)}
            >
              {useMetric ? "Metric" : "Imperial"}
            </button>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">No data in selected range</p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{fmt(summary.grand)} {chartUnit}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Average per {aggregation === "weekly" ? "Week" : "Month"}
                </p>
                <p className="text-2xl font-bold text-foreground">{fmt(summary.avg)} {chartUnit}</p>
              </div>
              {series.length > 1 && (
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                  {series.map((s, i) => (
                    <div key={s.key}>
                      <p className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn("exercise-dot", s.colorClass)} /> {s.label}
                      </p>
                      <p className={cn("exercise-fg text-lg font-bold", s.colorClass)}>
                        {fmt(summary.totals[i])}
                        <span className="ml-1 text-sm font-medium text-muted-foreground">{chartUnit}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
