import { GanttChartSquare } from "lucide-react";

import { timelineBarClass } from "@projectmanager/utils/colors";
import { useTimelineDashboard } from "@projectmanager/hooks/useProjectManager";

function dateToMs(str: string): number {
  return new Date(str).getTime();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function TimelineView() {
  const { data, isLoading, isError, error } = useTimelineDashboard();

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading timeline…</p>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        {(error as Error).message}
      </p>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="projectmanager-glass flex flex-col items-center gap-3 rounded-[var(--radius-lg)] p-10 text-center">
        <GanttChartSquare className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No timeline data available. Projects need start and end dates to
          appear here.
        </p>
      </div>
    );
  }

  const minMs = dateToMs(data.minDate);
  const maxMs = dateToMs(data.maxDate);
  const span = maxMs - minMs || 1;

  /** Convert a date string to a left-percentage within [minDate, maxDate]. */
  const toLeftPct = (str: string | null): number => {
    if (!str) return 0;
    return clamp(((dateToMs(str) - minMs) / span) * 100, 0, 100);
  };

  const toWidthPct = (
    start: string | null,
    end: string | null,
  ): number => {
    const l = toLeftPct(start);
    const r = end ? clamp(((dateToMs(end) - minMs) / span) * 100, 0, 100) : l + 1;
    return Math.max(r - l, 0.5);
  };

  return (
    <div className="projectmanager-fade-in flex flex-col gap-4">
      <header>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Timeline
        </h2>
        <p className="text-sm text-muted-foreground">
          Project and goal bars across time
        </p>
      </header>

      <div className="projectmanager-glass rounded-[var(--radius-lg)] overflow-hidden">
        <div className="projectmanager-timeline">
          {/* Date axis */}
          <div className="projectmanager-timeline-axis">
            {data.dateAxis.map((pt) => (
              <span
                key={pt.date}
                className="projectmanager-timeline-axis-label"
                style={{ left: `${pt.position * 100}%` }}
              >
                {pt.label}
              </span>
            ))}
          </div>

          {/* One row per item */}
          {data.items.map((item) => {
            const barClass = timelineBarClass(item.category_color);
            const leftPct = toLeftPct(item.start_date);
            const widthPct = toWidthPct(item.start_date, item.end_date);

            return (
              <div key={`${item.type}-${item.id}`} className="projectmanager-timeline-row">
                {/* Label */}
                <div
                  className="projectmanager-timeline-label"
                  title={item.name}
                >
                  <span className="text-xs text-muted-foreground mr-1">
                    {item.type === "goal" ? "↳" : ""}
                  </span>
                  {item.name}
                </div>

                {/* Bar track */}
                <div className="projectmanager-timeline-track">
                  <div
                    className={`projectmanager-timeline-bar ${barClass}`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                    }}
                    title={`${item.name} — ${item.start_date ?? "?"} → ${item.end_date ?? "?"}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
