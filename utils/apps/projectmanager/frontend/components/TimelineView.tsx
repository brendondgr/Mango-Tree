import { CornerDownRight, GanttChartSquare } from "lucide-react";
import type { CSSProperties } from "react";

import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryAccent } from "@projectmanager/utils/colors";
import { useTimelineDashboard } from "@projectmanager/hooks/useProjectManager";

function dateToMs(str: string): number {
  return new Date(str).getTime();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function TimelineSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-32 shrink-0" />
          <Skeleton className="h-5 flex-1 rounded-[var(--radius-pill)]" />
        </div>
      ))}
    </div>
  );
}

/**
 * Project and goal bars across time.
 *
 * The chart is wider than a narrow pane can show, so it lives in a
 * `.scroll-region`: a focusable horizontal scroller. Previously the row grid
 * simply overflowed inside an `overflow-hidden` ancestor, which cut the right
 * side of the chart off with no way to reach it.
 */
export function TimelineView() {
  const { data, isLoading, error, refetch } = useTimelineDashboard();

  const minMs = data ? dateToMs(data.minDate) : 0;
  const maxMs = data ? dateToMs(data.maxDate) : 0;
  const span = maxMs - minMs || 1;

  /** Convert a date string to a left-percentage within [minDate, maxDate]. */
  const toLeftPct = (str: string | null): number => {
    if (!str) return 0;
    return clamp(((dateToMs(str) - minMs) / span) * 100, 0, 100);
  };

  const toWidthPct = (start: string | null, end: string | null): number => {
    const l = toLeftPct(start);
    const r = end ? clamp(((dateToMs(end) - minMs) / span) * 100, 0, 100) : l + 1;
    return Math.max(r - l, 0.5);
  };

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-foreground @[45rem]:text-2xl">
          Timeline
        </h2>
        <p className="text-sm text-muted-foreground">
          Project and goal bars across time
        </p>
      </header>

      <AsyncBoundary
        className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-xs"
        label="the timeline"
        loading={isLoading}
        error={error}
        empty={!data || data.items.length === 0}
        onRetry={() => void refetch()}
        skeleton={<TimelineSkeleton />}
        emptyIcon={GanttChartSquare}
        emptyTitle="Nothing to plot yet"
        emptyDescription="Projects and goals need start and end dates before they appear on the timeline."
      >
        <div
          className="scroll-region"
          tabIndex={0}
          role="group"
          aria-label="Timeline chart, scrolls horizontally"
        >
          <div className="min-w-[38rem]">
            {/* Date axis */}
            <div className="relative ml-32 h-8 border-b border-border @[48rem]:ml-48">
              {data?.dateAxis.map((pt) => (
                <span
                  key={pt.date}
                  className="absolute top-2 -translate-x-1/2 whitespace-nowrap text-[0.6875rem] font-medium text-muted-foreground"
                  style={{ left: `${pt.position * 100}%` }}
                >
                  {pt.label}
                </span>
              ))}
            </div>

            {/* One row per item */}
            {data?.items.map((item, index) => (
              <div
                key={`${item.type}-${item.id}`}
                data-enter
                style={{ "--i": index } as CSSProperties}
                className="flex min-h-10 items-center border-b border-border/50 last:border-0"
              >
                <div
                  className="flex w-32 shrink-0 items-center gap-1 truncate px-3 py-1.5 text-xs text-foreground @[48rem]:w-48 @[48rem]:text-sm"
                  title={item.name}
                >
                  {item.type === "goal" && (
                    <CornerDownRight
                      className="h-3 w-3 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  <span className="truncate">{item.name}</span>
                </div>

                <div className="relative min-h-10 flex-1">
                  <div
                    className="absolute top-1/2 h-5 min-w-1 -translate-y-1/2 rounded-[var(--radius-pill)] bg-[hsl(var(--pm-accent))] opacity-90"
                    style={{
                      ...categoryAccent(item.category_color),
                      left: `${toLeftPct(item.start_date)}%`,
                      width: `${toWidthPct(item.start_date, item.end_date)}%`,
                    }}
                    title={`${item.name} — ${item.start_date ?? "?"} → ${item.end_date ?? "?"}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </AsyncBoundary>
    </section>
  );
}
