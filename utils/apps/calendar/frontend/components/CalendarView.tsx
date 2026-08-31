import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";

import {
  SegmentedControl,
  type Segment,
} from "@/components/app-shell/SegmentedControl";
import { useIsNarrowPane } from "@/components/app-shell/MasterDetail";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { DirectEvent, MergedEvent } from "@/types/calendar";

import { usePalette, useRange, useWeek } from "../hooks/useCalendar";
import {
  buildColorIndex,
  categoryStyle,
  colorForType,
  type CategoryColor,
} from "../utils/colors";
import {
  DOW_LABELS,
  addDays,
  addMonths,
  dayNumber,
  dayOfWeek,
  monthGrid,
  monthLabel,
  monthOf,
  prettyDate,
  today,
  weekDates,
} from "../utils/dates";
import { type GridEvent, computeHourRange } from "../utils/timegrid";
import { ActiveDatesDialog } from "./ActiveDatesDialog";
import { DirectEventDialog } from "./DirectEventDialog";
import { EventChipMini, EventDot } from "./EventBlock";
import { TimeGrid } from "./TimeGrid";

type Mode = "week" | "month";
type Span = "1" | "3" | "7";

const MODES: Segment<Mode>[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

/** How many days the timeline shows. Only offered when the pane is narrow. */
const SPANS: Segment<Span>[] = [
  { value: "1", label: "Day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "Week" },
];

/** Chips a month cell can show before it collapses into a "+N more" line. */
const MAX_CHIPS = 3;
const MAX_DOTS = 5;

function toDirectEvent(date: string, ev: MergedEvent): DirectEvent {
  return {
    date,
    title: ev.title,
    type: ev.type,
    start: ev.start,
    end: ev.end,
    sub: ev.sub,
    _direct_index: ev._direct_index,
  };
}

function isOpenable(ev: MergedEvent): boolean {
  return ev._source === "direct" && ev._direct_index != null;
}

export function CalendarView() {
  const [paneRef, isNarrow] = useIsNarrowPane<HTMLDivElement>();

  const [anchor, setAnchor] = useState<string>(today());
  const [mode, setMode] = useState<Mode>("week");
  const [span, setSpan] = useState<Span>("3");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeDatesOpen, setActiveDatesOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<DirectEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>(today());

  const palette = usePalette();
  const colorIndex = useMemo(() => buildColorIndex(palette.data ?? []), [palette.data]);

  // A wide pane always shows the full week; the day / 3-day windows exist only
  // because seven legible columns do not fit in a narrow one.
  const spanDays = isNarrow ? Number(span) : 7;

  const timelineDates = useMemo(
    () =>
      spanDays === 7
        ? weekDates(anchor)
        : Array.from({ length: spanDays }, (_, i) => addDays(anchor, i)),
    [anchor, spanDays],
  );

  const cells = useMemo(() => monthGrid(anchor), [anchor]);

  const week = useWeek(mode === "week" ? anchor : undefined);
  // A short window can straddle two weeks, so it reads from the range endpoint
  // rather than the week one.
  const dayRange = useRange(
    timelineDates[0],
    timelineDates[timelineDates.length - 1],
    mode === "week" && spanDays !== 7,
  );
  const monthRange = useRange(cells[0], cells[41], mode === "month");

  const timeline = spanDays === 7 ? week : dayRange;
  const timelineDays = timeline.data?.days;
  const timelineColors = timeline.data?.colors;

  const todayStr = today();
  const anchorMonth = monthOf(anchor);

  // Keep the month selection inside the month being shown.
  useEffect(() => {
    if (mode !== "month") return;
    setSelectedDay((current) =>
      current && cells.includes(current) ? current : null,
    );
  }, [mode, cells]);

  function openNew(date: string) {
    setEditEvent(null);
    setDefaultDate(date);
    setDialogOpen(true);
  }

  function openEvent(date: string, ev: MergedEvent) {
    if (!isOpenable(ev)) return;
    setEditEvent(toDirectEvent(date, ev));
    setDialogOpen(true);
  }

  const gridEvents = useMemo<GridEvent[]>(() => {
    const out: GridEvent[] = [];
    timelineDates.forEach((date, dayIndex) => {
      for (const ev of timelineDays?.[date]?.events ?? []) {
        if (!ev.start || !ev.end) continue;
        out.push({
          dayIndex,
          start: ev.start,
          end: ev.end,
          title: ev.title,
          type: ev.type,
          sub: ev.sub,
          overwriteable: ev.overwriteable,
          meta: { date, event: ev },
        });
      }
    });
    return out;
  }, [timelineDates, timelineDays]);

  // Default 8am–10pm, expanding outward when plans run earlier or later.
  const hourRange = useMemo(() => {
    const base = { startHour: 8, endHour: 22 };
    if (gridEvents.length === 0) return base;
    const auto = computeHourRange(gridEvents);
    return {
      startHour: Math.min(base.startHour, auto.startHour),
      endHour: Math.max(base.endHour, auto.endHour),
    };
  }, [gridEvents]);

  function shift(delta: number) {
    setAnchor((a) =>
      mode === "week" ? addDays(a, delta * spanDays) : addMonths(a, delta),
    );
  }

  const periodLabel =
    mode === "month"
      ? monthLabel(anchor)
      : spanDays === 1
        ? prettyDate(timelineDates[0])
        : `${prettyDate(timelineDates[0], false)} – ${prettyDate(timelineDates[timelineDates.length - 1])}`;

  const stepLabel = mode === "month" ? "month" : spanDays === 1 ? "day" : "period";
  const selectedEvents = selectedDay
    ? (monthRange.data?.days?.[selectedDay]?.events ?? [])
    : [];

  return (
    <div ref={paneRef} className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(-1)}
            aria-label={`Previous ${stepLabel}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(today())}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(1)}
            aria-label={`Next ${stepLabel}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h3
          className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground"
          aria-live="polite"
        >
          {periodLabel}
        </h3>

        <SegmentedControl
          segments={MODES}
          value={mode}
          onValueChange={setMode}
          label="Calendar range"
        />

        {mode === "week" && isNarrow ? (
          <SegmentedControl
            segments={SPANS}
            value={span}
            onValueChange={setSpan}
            label="Days shown"
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setActiveDatesOpen(true)}>
            <CalendarRange className="h-4 w-4" />
            Active dates
          </Button>
          <Button size="sm" onClick={() => openNew(selectedDay ?? todayStr)}>
            <Plus className="h-4 w-4" />
            Event
          </Button>
        </div>
      </div>

      {mode === "week" ? (
        <div className="min-h-0 flex-1 overflow-hidden p-3 sm:p-4">
          <AsyncBoundary
            className="h-full min-h-0"
            label="this week"
            loading={timeline.isPending}
            error={timeline.error}
            onRetry={() => void timeline.refetch()}
            skeleton={<Skeleton className="h-full w-full rounded-[var(--radius-md)]" />}
          >
            <TimeGrid
              label={`Timeline for ${periodLabel}`}
              days={timelineDates.map((date) => ({
                key: date,
                label: DOW_LABELS[dayOfWeek(date)],
                sublabel: String(dayNumber(date)),
                isToday: date === todayStr,
              }))}
              events={gridEvents}
              range={hourRange}
              hourHeight={isNarrow ? 64 : 52}
              minDayWidth={spanDays === 1 ? 160 : spanDays === 3 ? 88 : 96}
              resolveColor={(type) => colorForType(type, timelineColors, colorIndex)}
              emptyHint="Nothing planned. Pick a column to add an event."
              onCellClick={(dayIndex) => openNew(timelineDates[dayIndex])}
              isEventActionable={(ev) =>
                isOpenable((ev.meta as { event: MergedEvent }).event)
              }
              onEventClick={(ev) => {
                const meta = ev.meta as { date: string; event: MergedEvent };
                openEvent(meta.date, meta.event);
              }}
            />
          </AsyncBoundary>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          <AsyncBoundary
            label="this month"
            loading={monthRange.isPending}
            error={monthRange.error}
            onRetry={() => void monthRange.refetch()}
            skeleton={<Skeleton className="h-[26rem] w-full rounded-[var(--radius-md)]" />}
          >
            <div
              className="calendar-month"
              // One inline value instead of a second breakpoint: a compact cell
              // is a date plus dots, an expanded one holds three chips.
              style={{ "--calendar-cell-h": isNarrow ? "3.25rem" : "7rem" } as never}
            >
              {DOW_LABELS.map((d) => (
                <div
                  key={d}
                  className="bg-card px-1 py-1 text-center text-[0.7rem] font-medium text-muted-foreground"
                >
                  {isNarrow ? d.charAt(0) : d}
                </div>
              ))}
              {cells.map((date) => {
                const events = monthRange.data?.days?.[date]?.events ?? [];
                const outside = monthOf(date) !== anchorMonth;
                return (
                  <button
                    key={date}
                    type="button"
                    className="calendar-monthcell flex flex-col items-stretch gap-0.5 p-1 text-left"
                    data-outside={outside || undefined}
                    data-selected={date === selectedDay || undefined}
                    // `aria-current`, not `aria-pressed`: a cell in a date grid
                    // marks which day is current, and picking another one is
                    // what unmarks it. As a toggle it could only ever be
                    // pressed, since nothing here un-selects a day.
                    aria-current={date === selectedDay ? "date" : undefined}
                    aria-label={`${prettyDate(date)}, ${events.length} event${events.length === 1 ? "" : "s"}`}
                    onClick={() => setSelectedDay(date)}
                  >
                    <span
                      className={
                        date === todayStr
                          ? "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-primary text-[0.7rem] font-semibold text-primary-foreground"
                          : "text-[0.7rem] font-semibold"
                      }
                    >
                      {dayNumber(date)}
                    </span>

                    {isNarrow ? (
                      <span className="flex flex-wrap items-center gap-0.5">
                        {events.slice(0, MAX_DOTS).map((ev, idx) => (
                          <EventDot
                            key={idx}
                            color={colorForType(ev.type, monthRange.data?.colors, colorIndex)}
                          />
                        ))}
                        {events.length > MAX_DOTS ? (
                          <span className="text-[0.6rem] leading-none text-muted-foreground">
                            +{events.length - MAX_DOTS}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="flex min-w-0 flex-col gap-0.5 overflow-hidden">
                        {/* Read-only inside the cell: the cell is itself the
                            button that selects the day, and a button nested in
                            a button is neither valid nor operable. Opening an
                            event happens in the day panel below. */}
                        {events.slice(0, MAX_CHIPS).map((ev, idx) => (
                          <EventChipMini
                            key={idx}
                            event={ev}
                            color={colorForType(ev.type, monthRange.data?.colors, colorIndex)}
                          />
                        ))}
                        {events.length > MAX_CHIPS ? (
                          <span className="px-1 text-[0.62rem] text-muted-foreground">
                            +{events.length - MAX_CHIPS} more
                          </span>
                        ) : null}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <DayPanel
              date={selectedDay}
              events={selectedEvents}
              resolveColor={(type) =>
                colorForType(type, monthRange.data?.colors, colorIndex)
              }
              onAdd={() => selectedDay && openNew(selectedDay)}
              onOpen={(ev) => selectedDay && openEvent(selectedDay, ev)}
            />
          </AsyncBoundary>
        </div>
      )}

      <DirectEventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editEvent}
        defaultDate={defaultDate}
      />
      <ActiveDatesDialog open={activeDatesOpen} onOpenChange={setActiveDatesOpen} />
    </div>
  );
}

/**
 * The selected day's agenda, under the month grid.
 *
 * On a compact cell the chips become dots, which carry a category but not a
 * title — this is where the titles go, at a full touch-target row height, so
 * the month view stays usable rather than merely tidy.
 */
function DayPanel({
  date,
  events,
  resolveColor,
  onAdd,
  onOpen,
}: {
  date: string | null;
  events: MergedEvent[];
  resolveColor: (type: string) => CategoryColor;
  onAdd: () => void;
  onOpen: (ev: MergedEvent) => void;
}) {
  if (!date) {
    return (
      <p className="mt-3 text-center text-sm text-muted-foreground">
        Pick a day to see its events.
      </p>
    );
  }

  return (
    <section
      className="mt-3 rounded-[var(--radius-md)] border border-border bg-card p-3 shadow-xs"
      aria-label={`Events on ${prettyDate(date)}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {prettyDate(date)}
        </h4>
        <Button size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4" />
          Add event
        </Button>
      </div>

      {events.length === 0 ? (
        <EmptyState
          compact
          icon={CalendarDays}
          title="Nothing scheduled"
          description="This day is free."
        />
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {events.map((ev, idx) => {
            const body = (
              <>
                <span
                  aria-hidden
                  className="calendar-solid h-2 w-2 shrink-0 rounded-full"
                  style={categoryStyle(resolveColor(ev.type))}
                />
                <span className="w-[5.5rem] shrink-0 text-xs tabular-nums text-muted-foreground">
                  {ev.start}–{ev.end}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {ev.title}
                  {ev.sub ? (
                    <span className="text-muted-foreground"> · {ev.sub}</span>
                  ) : null}
                </span>
              </>
            );
            const rowClass =
              "flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left app:min-h-9";

            return (
              <li key={idx} data-enter style={{ "--i": idx } as never}>
                {isOpenable(ev) ? (
                  <button
                    type="button"
                    className={`${rowClass} transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                    onClick={() => onOpen(ev)}
                  >
                    {body}
                  </button>
                ) : (
                  <span className={rowClass}>{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
