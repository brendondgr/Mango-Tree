import { useMemo, useRef } from "react";
import { Plus } from "lucide-react";

import type { EventColor } from "../utils/colors";
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

const TIME_COL = 56; // px width of the left time gutter
const DEFAULT_HOUR_HEIGHT = 52;

export function TimeGrid({
  days,
  events,
  resolveColor,
  onCellClick,
  onEventClick,
  hourHeight = DEFAULT_HOUR_HEIGHT,
  range,
  emptyHint,
}: {
  days: TimeGridDay[];
  events: GridEvent[];
  resolveColor: (type: string) => EventColor;
  onCellClick?: (dayIndex: number, time: string) => void;
  onEventClick?: (ev: GridEvent) => void;
  hourHeight?: number;
  range?: HourRange;
  emptyHint?: string;
}) {
  const hourRange = useMemo(
    () => range ?? computeHourRange(events),
    [range, events],
  );
  const hours = useMemo(() => hoursIn(hourRange), [hourRange]);
  const rangeStartMin = hourRange.startHour * 60;
  const rangeEndMin = hourRange.endHour * 60;
  const contentHeight = hours.length * hourHeight;

  // Split overwriteable events per day, then keep only what's in range.
  const segmentsByDay = useMemo(() => {
    const byDay = new Map<number, GridEvent[]>();
    days.forEach((_, i) => byDay.set(i, []));
    for (const ev of events) {
      if (byDay.has(ev.dayIndex)) byDay.get(ev.dayIndex)!.push(ev);
    }
    return days.map((_, i) => processOverlapSegments(byDay.get(i) ?? []));
  }, [events, days]);

  const colTemplate = `${TIME_COL}px repeat(${days.length}, minmax(0, 1fr))`;
  const hasEvents = events.length > 0;

  function cellTimeFromClick(e: React.MouseEvent, bodyTop: number): string {
    const offsetY = e.clientY - bodyTop;
    const minutes = rangeStartMin + Math.floor(offsetY / hourHeight) * 60;
    const clamped = Math.max(rangeStartMin, Math.min(rangeEndMin - 60, minutes));
    return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:00`;
  }

  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <div className="tg-root">
      {/* Sticky header: corner + day labels */}
      <div className="tg-head" style={{ gridTemplateColumns: colTemplate }}>
        <div className="tg-corner" />
        {days.map((d) => (
          <div key={d.key} className="tg-dayhead" data-today={d.isToday || undefined}>
            <span className="tg-dayhead-label">{d.label}</span>
            {d.sublabel ? <span className="tg-dayhead-sub">{d.sublabel}</span> : null}
          </div>
        ))}
      </div>

      {/* Scrollable timeline body */}
      <div className="tg-scroll">
        <div
          ref={bodyRef}
          className="tg-body"
          style={{ height: contentHeight, minHeight: "100%" }}
        >
          {/* Full-height day columns (reach the bottom of the page) */}
          <div className="tg-cols" style={{ left: TIME_COL }}>
            {days.map((d, dayIndex) => (
              <div
                key={d.key}
                className="tg-col"
                data-today={d.isToday || undefined}
                onClick={
                  onCellClick
                    ? (e) => {
                        const top = bodyRef.current?.getBoundingClientRect().top ?? 0;
                        onCellClick(dayIndex, cellTimeFromClick(e, top));
                      }
                    : undefined
                }
              >
                {onCellClick ? (
                  <button
                    type="button"
                    className="tg-add"
                    aria-label={`Add event on ${d.label}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const start = hours.length
                        ? `${String(hourRange.startHour + Math.floor(hours.length / 2)).padStart(2, "0")}:00`
                        : "09:00";
                      onCellClick(dayIndex, start);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {/* Hour lines + time labels */}
          {hours.map((h, i) => (
            <div
              key={h}
              className="tg-hourline"
              style={{ top: i * hourHeight, height: hourHeight }}
            >
              <span className="tg-hourlabel">{formatHour(h)}</span>
            </div>
          ))}

          {/* Event cards (absolutely positioned over the columns) */}
          {segmentsByDay.map((segs, dayIndex) =>
            segs.map((ev, idx) => {
              const startMin = parseTimeToMinutes(ev.start);
              const endMin = parseTimeToMinutes(ev.end);
              if (endMin <= rangeStartMin || startMin >= rangeEndMin) return null;

              const top = ((startMin - rangeStartMin) / 60) * hourHeight;
              const height = Math.max(((endMin - startMin) / 60) * hourHeight - 2, 14);
              const color = resolveColor(ev.type);
              const compact = height < 38;

              return (
                <button
                  key={`${dayIndex}-${idx}`}
                  type="button"
                  className="tg-event"
                  data-segment={ev._isSegment || undefined}
                  style={{
                    top: top + 1,
                    height,
                    left: `calc(${TIME_COL}px + ${dayIndex} * ((100% - ${TIME_COL}px) / ${days.length}))`,
                    width: `calc((100% - ${TIME_COL}px) / ${days.length} - 4px)`,
                    zIndex: ev._zIndex,
                    background: color.bg,
                    borderLeftColor: color.border,
                    color: color.text,
                  }}
                  title={`${ev.start}–${ev.end} · ${ev._parentTitle}${ev.sub ? ` · ${ev.sub}` : ""}`}
                  onClick={
                    onEventClick
                      ? (e) => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }
                      : undefined
                  }
                >
                  <span className="tg-event-title">{ev._parentTitle}</span>
                  {!compact ? (
                    <span className="tg-event-time">
                      {ev.start}–{ev.end}
                    </span>
                  ) : null}
                  {!compact && ev.sub && height > 64 ? (
                    <span className="tg-event-sub">{ev.sub}</span>
                  ) : null}
                </button>
              );
            }),
          )}

          {!hasEvents && emptyHint ? (
            <div className="tg-empty">{emptyHint}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
