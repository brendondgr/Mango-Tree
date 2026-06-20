import { useMemo } from "react";
import { Activity, Dumbbell, Flame, TrendingUp } from "lucide-react";

import { BarChart } from "@exercise/components/BarChart";
import { StatCard } from "@exercise/components/StatCard";
import { useHistory, useWorkouts } from "@exercise/hooks/useExercise";
import { dayKey, formatDuration, formatNumber } from "@exercise/utils/format";

export function DashboardView() {
  const history = useHistory();
  const workouts = useWorkouts();

  const logs = history.data ?? [];

  const stats = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const thisWeek = logs.filter((log) => {
      const t = new Date(log.date).getTime();
      return !Number.isNaN(t) && t >= weekAgo;
    }).length;
    const totalVolume = logs.reduce((sum, log) => sum + (log.volume || 0), 0);
    const totalDuration = logs.reduce((sum, log) => sum + (log.duration || 0), 0);
    return { thisWeek, totalVolume, totalDuration };
  }, [logs]);

  const chartData = useMemo(() => {
    const days: Array<{ label: string; value: number }> = [];
    const byDay = new Map<string, number>();
    for (const log of logs) byDay.set(dayKey(log.date), (byDay.get(dayKey(log.date)) ?? 0) + 1);
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ label: key.slice(5), value: byDay.get(key) ?? 0 });
    }
    return days;
  }, [logs]);

  if (history.isLoading || workouts.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  }
  if (history.isError) {
    return <p className="text-sm text-destructive">{(history.error as Error).message}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sessions" value={String(logs.length)} icon={Activity} />
        <StatCard label="This week" value={String(stats.thisWeek)} icon={Flame} hint="last 7 days" />
        <StatCard
          label="Total volume"
          value={formatNumber(stats.totalVolume)}
          icon={TrendingUp}
        />
        <StatCard
          label="Workouts"
          value={String(workouts.data?.length ?? 0)}
          icon={Dumbbell}
          hint="templates"
        />
      </div>

      <section className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Sessions — last 14 days</h2>
          <span className="text-xs text-muted-foreground">
            {formatDuration(stats.totalDuration)} logged all-time
          </span>
        </header>
        <BarChart data={chartData} ariaLabel="Sessions logged per day over the last 14 days" />
      </section>
    </div>
  );
}
