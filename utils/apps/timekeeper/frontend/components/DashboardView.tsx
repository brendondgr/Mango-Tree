import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import type { Category, TimeLog } from "@/types/timekeeper";

import { useAllLogs } from "@timekeeper/hooks/useTimekeeper";
import { formatMinutes, hhmmToIndex } from "@timekeeper/utils/blocks";
import { buildResolver } from "@timekeeper/utils/colors";

type Range = 7 | 30 | 0; // 0 == all

interface Props {
  categories: Category[];
}

function withinRange(logs: TimeLog[], days: Range): TimeLog[] {
  if (days === 0) return logs;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  return logs.filter((l) => l.date >= cutoffISO);
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

export function DashboardView({ categories }: Props) {
  const { data: logs, isLoading } = useAllLogs();
  // Default to "All" so the dashboard shows data regardless of how recent it is.
  const [range, setRange] = useState<Range>(0);
  const resolver = useMemo(() => buildResolver(categories), [categories]);

  const stats = useMemo(() => {
    const active = withinRange((logs ?? []).filter((l) => l.duration > 0), range);

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

    const trend = [...perDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30);

    const distribution = [...perCategory.entries()]
      .map(([id, mins]) => ({ id, mins, ...resolver.resolve(id, null) }))
      .sort((a, b) => b.mins - a.mins);

    return { total, avg, busiestHour, p75, trend, distribution, hasData: active.length > 0 };
  }, [logs, range, resolver]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const maxTrend = Math.max(1, ...stats.trend.map(([, m]) => m));
  const maxDist = Math.max(1, ...stats.distribution.map((d) => d.mins));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Insights Dashboard</h2>
        <div className="timekeeper-card flex gap-1 p-1">
          {([7, 30, 0] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              className="timekeeper-tab"
              data-active={range === r}
              onClick={() => setRange(r)}
            >
              {r === 0 ? "All" : `${r}D`}
            </button>
          ))}
        </div>
      </div>

      {!stats.hasData ? (
        <div className="timekeeper-card p-10 text-center text-muted-foreground">
          No tracked time in this range.
        </div>
      ) : (
        <>
          {/* stat cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="timekeeper-stat" style={{ borderLeftColor: "hsl(var(--primary))" }}>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Period total</p>
              <p className="timekeeper-stat-value">{formatMinutes(stats.total)}</p>
            </div>
            <div className="timekeeper-stat" style={{ borderLeftColor: "hsl(var(--accent))" }}>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Avg / day</p>
              <p className="timekeeper-stat-value">{formatMinutes(stats.avg)}</p>
            </div>
            <div className="timekeeper-stat" style={{ borderLeftColor: "hsl(var(--category-sky))" }}>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Busiest hour</p>
              <p className="timekeeper-stat-value tabular-nums">
                {String(stats.busiestHour).padStart(2, "0")}:00
              </p>
            </div>
            <div className="timekeeper-stat" style={{ borderLeftColor: "hsl(var(--category-amber))" }}>
              <p className="text-xs font-semibold uppercase text-muted-foreground">75th pct / day</p>
              <p className="timekeeper-stat-value">{formatMinutes(stats.p75)}</p>
            </div>
          </div>

          {/* trend */}
          <div className="timekeeper-card p-4">
            <h3 className="mb-4 text-sm font-bold">Daily trend (last {stats.trend.length} days)</h3>
            <div className="flex h-40 items-end gap-1">
              {stats.trend.map(([day, mins]) => (
                <div
                  key={day}
                  className="flex-1"
                  title={`${day}: ${formatMinutes(mins)}`}
                  style={{
                    height: `${(mins / maxTrend) * 100}%`,
                    minHeight: 2,
                    background: "hsl(var(--primary) / 0.65)",
                    borderRadius: "3px 3px 0 0",
                  }}
                />
              ))}
            </div>
          </div>

          {/* distribution */}
          <div className="timekeeper-card p-4">
            <h3 className="mb-4 text-sm font-bold">Time by category</h3>
            <div className="flex flex-col gap-2.5">
              {stats.distribution.map((d) => (
                <div key={d.id} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-sm">{d.categoryName}</span>
                  <div className="timekeeper-bar-track flex-1">
                    <div
                      className="timekeeper-bar-fill"
                      style={{ width: `${(d.mins / maxDist) * 100}%`, background: d.color }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {formatMinutes(d.mins)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
