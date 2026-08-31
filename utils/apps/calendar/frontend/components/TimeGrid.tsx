import { useMemo, type CSSProperties } from "react";
import { Plus } from "lucide-react";

import { categoryStyle, type CategoryColor } from "../utils/colors";
import {
  type GridEvent,
  type HourRange,
  computeHourRange,
  formatHour,
  hoursIn,
  parseTimeToMinutes,
  processOverlapSegments,
} from "../utils/timegrid";

export interface TimeGridDay {
  key: string;
  label: string;
  sublabel?: string;
  isToday?: boolean;
}

/** Width of the left time gutter. */
const TIME_COL = 52;
/** Below this a column cannot hold a legible title, so the grid scrolls. */
const DEFAULT_MIN_DAY = 96;
const DEFAULT_HOUR_HEIGHT = 52;
/** Nothing on the timeline may be smaller than the minimum touch target. */
const MIN_EVENT_HEIGHT = 24;

/**
 * An hour-by-hour timeline for an arbitrary list of days.
 *
 * The old implementation laid events out as percentages of the grid's own
 * width (`calc((100% - 56px) / days.length)`), which is why seven columns in a
 * 360px pane computed to ~7px each and event cards to under 3px: there was no
 * width below which it stopped dividing. Now each day is a real grid track with
 * a `minmax(minDayWidth, 1fr)` floor and events are positioned inside their own
 * column, so a window too narrow for the days it is asked to show becomes a
 * horizontal scroll region rather than an unreadable one. Callers additionally
 * pass fewer `days` on a narrow pane; both mechanisms are needed, because the
 * pane can always be dragged narrower than one legible column.
 */
export function TimeGrid({
  days,
  events,
  resolveColor,
  onCellClick,
  onEventClick,
  isEventActionable,
  hourHeight = DEFAULT_HOUR_HEIGHT,
  minDayWidth = DEFAULT_MIN_DAY,
  range,
  emptyHint,
  label = "Timeline",
}: {
  days: TimeGridDay[];
  events: GridEvent[];
  resolveColor: (type: string) => CategoryColor;
  onCellClick?: (dayIndex: number, time: string) => void;
  onEventClick?: (ev: GridEvent) => void;
  /** Whether activating this event does anything. Defaults to true. */
  isEventActionable?: (ev: GridEvent) => boolean;
  hourHeight?: number;
  minDayWidth?: number;
  range?: HourRange;
  emptyHint?: string;
  /** Accessible name for the scroll region. */
  label?: string;
}) {
  const hourRange = useMemo(() => range ?? computeHourRange(events), [range, events]);
  const hours = useMemo(() => hoursIn(hourRange), [hourRange]);
  const rangeStartMin = hourRange.startHour * 60;
  const rangeEndMin = hourRange.endHour * 60;
  const contentHeight = hours.length * hourHeight;

  // Split overwriteable events per day so they read as gaps around real
  // commitments, then keep only what falls inside the visible hour range.
  const segmentsByDay = useMemo(() => {
    const byDay = new Map<number, GridEvent[]>();
    days.forEach((_, i) => byDay.set(i, []));
    for (const ev of events) {
      if (byDay.has(ev.dayIndex)) byDay.get(ev.dayIndex)!.push(ev);
    }
    return days.map((_, i) => processOverlapSegments(byDay.get(i) ?? []));
  }, [events, days]);

  // From the laid-out segments, not from `events`: callers pass the whole set
  // and let the grid select the visible days, so `events.length > 0` was true
  // for a window with nothing in it and the hint never appeared.
  const hasEvents = segmentsByDay.some((day) => day.length > 0);
  const midHour = hourRange.startHour + Math.floor(hours.length / 2);

  const gridVars = {
    "--tg-cols": `${TIME_COL}px repeat(${days.length}, minmax(${minDayWidth}px, 1fr))`,
    "--tg-min-w": `${TIME_COL + days.length * minDayWidth}px`,
    "--tg-hour-h": `${hourHeight}px`,
  } as CSSProperties;

  /**
   * The hour a pointer landed on. A keyboard activation has no coordinates
   * (`detail === 0`), so it falls back to the middle of the visible range
   * rather than silently doing nothing.
   */
  function timeFromActivation(
    e: React.MouseEvent<HTMLButtonElement>,
    fallbackHour: number,
  ): string {
    if (e.detail === 0) return `${String(fallbackHour).padStart(2, "0")}:00`;
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = rangeStartMin + Math.floor((e.clientY - rect.top) / hourHeight) * 60;
    const clamped = Math.max(rangeStartMin, Math.min(rangeEndMin - 60, minutes));
    return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:00`;
  }

  return (
    <div className="calendar-tg-root" style={gridVars}>
      <div
        className="scroll-region min-h-0 flex-1 overflow-y-auto"
        tabIndex={0}
        role="region"
        aria-label={label}
      >
        <div className="calendar-tg-inner">
          <div className="calendar-tg-head">
            <div className="calendar-tg-corner" />
            {days.map((d) => (
              <div
                key={d.key}
                className="calendar-tg-dayhead flex min-h-10 flex-col items-center justify-center px-1 py-1.5"
                data-today={d.isToday || undefined}
              >
                <span className="text-xs font-semibold text-foreground">{d.label}</span>
                {d.sublabel ? (
                  <span className="text-[0.7rem] tabular-nums text-muted-foreground">
                    {d.sublabel}
                  </span>
                ) : null}
              </div>
            ))}
          </div>

          {/* `height` is the hour range; the body also grows to fill the card
              (see `.calendar-tg-body` in calendar.css), because at the 4-hour
              minimum the range is shorter than the card and the day columns,
              hour rules and vertical borders would stop halfway down it. */}
          <div className="calendar-tg-body" style={{ height: contentHeight }}>
            <div className="calendar-tg-gutter">
              {hours.map((h, i) => (
                <span
                  key={h}
                  className="absolute right-1.5 text-[0.66rem] tabular-nums text-muted-foreground"
                  style={{ top: i * hourHeight + 2 }}
                >
                  {formatHour(h)}
                </span>
              ))}
            </div>

            {days.map((d, dayIndex) => (
              <div
                key={d.key}
                className="calendar-tg-col"
                data-today={d.isToday || undefined}
                data-empty={segmentsByDay[dayIndex].length === 0 || undefined}
              >
                {onCellClick ? (
                  <button
                    type="button"
                    className="calendar-tg-colbtn flex items-start justify-center pt-1.5"
                    aria-label={`Add an event on ${d.label}`}
                    onClick={(e) => onCellClick(dayIndex, timeFromActivation(e, midHour))}
                  >
                    <span className="calendar-tg-colhint inline-flex min-h-6 items-center gap-1 rounded-[var(--radius-pill)] border border-border bg-card px-2 text-[0.7rem] font-medium text-muted-foreground shadow-xs">
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </span>
                  </button>
                ) : null}

                {segmentsByDay[dayIndex].map((ev, idx) => {
                  const startMin = parseTimeToMinutes(ev.start);
                  const endMin = parseTimeToMinutes(ev.end);
                  if (endMin <= rangeStartMin || startMin >= rangeEndMin) return null;

                  const top = ((startMin - rangeStartMin) / 60) * hourHeight;
                  const height = Math.max(
                    ((endMin - startMin) / 60) * hourHeight - 2,
                    MIN_EVENT_HEIGHT,
                  );
                  const compact = height < 40;
                  const detail = `${ev.start}–${ev.end} · ${ev._parentTitle}${ev.sub ? ` · ${ev.sub}` : ""}`;
                  // Only events that actually respond become controls. A
                  // schedule-derived block has no editor, and a focusable
                  // button that does nothing when activated is a dead stop
                  // for a keyboard user.
                  const actionable = Boolean(
                    onEventClick && (isEventActionable?.(ev) ?? true),
                  );
                  const inner = (
                    <>
                      <span className="truncate text-[0.72rem] font-semibold">
                        {ev._parentTitle}
                      </span>
                      {!compact ? (
                        <span className="text-[0.64rem] tabular-nums opacity-80">
                          {ev.start}–{ev.end}
                        </span>
                      ) : null}
                      {!compact && ev.sub && height > 66 ? (
                        <span className="truncate text-[0.64rem] opacity-75">{ev.sub}</span>
                      ) : null}
                    </>
                  );
                  const shared = {
                    className:
                      "calendar-tg-event calendar-tint flex flex-col gap-px overflow-hidden rounded-[var(--radius-sm)] px-1.5 py-1 text-left leading-tight",
                    "data-segment": ev._isSegment || undefined,
                    "data-top": ev._zIndex >= 10 || undefined,
                    style: categoryStyle(resolveColor(ev.type), {
                      top: top + 1,
                      height,
                    }),
                    title: detail,
                  };

                  return actionable ? (
                    <button
                      key={`${d.key}-${idx}`}
                      type="button"
                      {...shared}
                      aria-label={detail}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick!(ev);
                      }}
                    >
                      {inner}
                    </button>
                  ) : (
                    <div key={`${d.key}-${idx}`} {...shared}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            ))}

            {!hasEvents && emptyHint ? (
              <p className="pointer-events-none absolute inset-x-0 top-6 px-4 text-center text-sm text-muted-foreground">
                {emptyHint}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
