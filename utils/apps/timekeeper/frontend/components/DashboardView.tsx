import { useMemo, useState } from "react";
import { BarChart3, Clock, Gauge, Sunrise, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import {
  SegmentedControl,
  type Segment,
} from "@/components/app-shell/SegmentedControl";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimeLog } from "@/types/timekeeper";

import { useAllLogs, useCategories } from "@timekeeper/hooks/useTimekeeper";
import { formatMinutes, hhmmToIndex } from "@timekeeper/utils/blocks";
import { buildResolver } from "@timekeeper/utils/colors";

type RangeId = "7" | "30" | "all";

const RANGES: Segment<RangeId>[] = [
  { value: "7", label: "7D" },
  { value: "30", label: "30D" },
  { value: "all", label: "All" },
];

function withinRange(logs: TimeLog[], days: number): TimeLog[] {
  if (days === 0) return logs;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  return logs.filter((log) => log.date >= cutoffISO);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  if (low === high) return sorted[low];
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

export function DashboardView() {
  const setView = useWorkspaceStore((state) => state.setTimekeeperView);
  const logsQuery = useAllLogs();
  const categoriesQuery = useCategories();
  // Default to "All" so the dashboard shows data regardless of how recent it is.
  const [range, setRange] = useState<RangeId>("all");

  const resolver = useMemo(
    () => buildResolver(categoriesQuery.data ?? []),
    [categoriesQuery.data],
  );

  const stats = useMemo(() => {
    const days = range === "all" ? 0 : Number(range);
    const active = withinRange(
      (logsQuery.data ?? []).filter((log) => log.duration > 0),
      days,
    );

    const perDay = new Map<string, number>();
    const perHour = new Array<number>(24).fill(0);
    const perCategory = new Map<string, number>();

    for (const log of active) {
      perDay.set(log.date, (perDay.get(log.date) ?? 0) + log.duration);
      const hour = Math.floor(hhmmToIndex(log.start_time) / 12);
      perHour[hour] += log.duration;
      const key = log.category_id ?? "untracked";
      perCategory.set(key, (perCategory.get(key) ?? 0) + log.duration);
    }

    const dayTotals = [...perDay.values()];
    const total = dayTotals.reduce((a, b) => a + b, 0);
    const avg = perDay.size ? Math.round(total / perDay.size) : 0;
    const busiestHour = perHour.indexOf(Math.max(0, ...perHour));
    const p75 = Math.round(percentile(dayTotals, 75));

    const trend = [...perDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-30);

    const distribution = [...perCategory.entries()]
      .map(([id, mins]) => ({ id, mins, ...resolver.resolve(id, null) }))
      .sort((a, b) => b.mins - a.mins);

    return { total, avg, busiestHour, p75, trend, distribution, hasData: active.length > 0 };
  }, [logsQuery.data, range, resolver]);

  const maxTrend = Math.max(1, ...stats.trend.map(([, mins]) => mins));
  const maxDistribution = Math.max(1, ...stats.distribution.map((entry) => entry.mins));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 @[34rem]:p-4 @[60rem]:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">Insights</h3>
        <SegmentedControl
          segments={RANGES}
          value={range}
          onValueChange={setRange}
          label="Reporting range"
        />
      </div>

      <AsyncBoundary
        loading={logsQuery.isLoading || categoriesQuery.isLoading}
        error={logsQuery.error ?? categoriesQuery.error}
        empty={!stats.hasData}
        onRetry={() => {
          void logsQuery.refetch();
          void categoriesQuery.refetch();
        }}
        label="tracked time"
        skeleton={<DashboardSkeleton />}
        emptyIcon={BarChart3}
        emptyTitle="No tracked time in this range"
        emptyDescription="Pick a wider range, or paint and submit a day on the tracker."
        emptyAction={
          <Button variant="outline" onClick={() => setView("tracker")}>
            Open the tracker
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 @[48rem]:grid-cols-4">
            <StatCard icon={Clock} label="Period total" value={formatMinutes(stats.total)} index={0} />
            <StatCard icon={Gauge} label="Avg / day" value={formatMinutes(stats.avg)} index={1} />
            <StatCard
              icon={Sunrise}
              label="Busiest hour"
              value={`${String(stats.busiestHour).padStart(2, "0")}:00`}
              index={2}
            />
            <StatCard
              icon={TrendingUp}
              label="75th pct / day"
              value={formatMinutes(stats.p75)}
              index={3}
            />
          </div>

          <section className="rounded-[var(--radius-lg)] border border-border bg-card p-4 shadow-xs">
            <h4 className="mb-4 text-sm font-semibold">
              Daily trend (last {stats.trend.length} days)
            </h4>
            <div
              role="img"
              aria-label={`Daily tracked time for the last ${stats.trend.length} days, peaking at ${formatMinutes(maxTrend)}`}
              className="flex h-40 items-end gap-1"
            >
              {stats.trend.map(([day, mins]) => (
                <div
                  key={day}
                  title={`${day}: ${formatMinutes(mins)}`}
                  className="min-h-[2px] flex-1 rounded-t-[var(--radius-sm)] bg-primary/70"
                  style={{ height: `${(mins / maxTrend) * 100}%` }}
                />
              ))}
            </div>
            {/* The same numbers as text, so the chart is not pointer-only. */}
            <table className="sr-only">
              <caption>Daily tracked time</caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col">Tracked</th>
                </tr>
              </thead>
              <tbody>
                {stats.trend.map(([day, mins]) => (
                  <tr key={day}>
                    <td>{day}</td>
                    <td>{formatMinutes(mins)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-[var(--radius-lg)] border border-border bg-card p-4 shadow-xs">
            <h4 className="mb-4 text-sm font-semibold">Time by category</h4>
            <ul className="flex flex-col gap-2.5">
              {stats.distribution.map((entry, index) => (
                <li
                  key={entry.id}
                  data-enter
                  style={{ "--i": index } as never}
                  className="flex items-center gap-3"
                >
                  <span className="w-24 shrink-0 truncate text-sm @[34rem]:w-32">
                    {entry.categoryName}
                  </span>
                  <span
                    aria-hidden
                    className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-[var(--radius-pill)] bg-surface-2"
                  >
                    <span
                      className="block h-full rounded-[var(--radius-pill)]"
                      style={{
                        width: `${(entry.mins / maxDistribution) * 100}%`,
                        background: entry.color,
                      }}
                    />
                  </span>
                  <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {formatMinutes(entry.mins)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </AsyncBoundary>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  index,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  index: number;
}) {
  return (
    <div
      data-enter
      style={{ "--i": index } as never}
      className="flex flex-col gap-1.5 rounded-[var(--radius-lg)] border border-border bg-card p-3 shadow-xs @[34rem]:p-4"
    >
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-primary/10 text-primary-emphasis"
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 truncate">{label}</span>
      </span>
      <span className="text-xl font-bold tabular-nums @[34rem]:text-2xl">{value}</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-1" aria-hidden>
      <div className="grid grid-cols-2 gap-3 @[48rem]:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[5.5rem] rounded-[var(--radius-lg)]" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-[var(--radius-lg)]" />
      <Skeleton className="h-40 rounded-[var(--radius-lg)]" />
    </div>
  );
}
