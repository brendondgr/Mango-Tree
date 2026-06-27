import { useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DirectEvent, MergedEvent } from "@/types/calendar";

import { usePalette, useRange, useWeek } from "../hooks/useCalendar";
import { buildClassToHex, colorForType } from "../utils/colors";
import {
  DOW_LABELS,
  addDays,
  addMonths,
  dayNumber,
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
import { EventChipMini } from "./EventBlock";
import { TimeGrid } from "./TimeGrid";

type Mode = "week" | "month";

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

export function CalendarView() {
  const [anchor, setAnchor] = useState<string>(today());
  const [mode, setMode] = useState<Mode>("week");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeDatesOpen, setActiveDatesOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<DirectEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>(today());

  const palette = usePalette();
  const classToHex = useMemo(
    () => buildClassToHex(palette.data ?? []),
    [palette.data],
  );

  const cells = useMemo(() => monthGrid(anchor), [anchor]);
  const week = useWeek(mode === "week" ? anchor : undefined);
  const range = useRange(cells[0], cells[41], mode === "month");

  const todayStr = today();
  const anchorMonth = monthOf(anchor);

  function openNew(date: string) {
    setEditEvent(null);
    setDefaultDate(date);
    setDialogOpen(true);
  }

  function openEvent(date: string, ev: MergedEvent) {
    if (ev._source === "direct" && ev._direct_index != null) {
      setEditEvent(toDirectEvent(date, ev));
      setDialogOpen(true);
    }
  }

  // Week timeline: flatten the merged week buckets into TimeGrid events. Each
  // event carries its source date + merged payload so clicks can reopen it.
  const weekDateList = useMemo(() => weekDates(anchor), [anchor]);
  const weekGridEvents = useMemo<GridEvent[]>(() => {
    const out: GridEvent[] = [];
    weekDateList.forEach((date, dayIndex) => {
      const events = week.data?.days?.[date]?.events ?? [];
      for (const ev of events) {
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
  }, [weekDateList, week.data]);

  // Week hours: default 8am–10pm, expanding outward when plans run earlier/later.
  const weekRange = useMemo(() => {
    const base = { startHour: 8, endHour: 22 };
    if (weekGridEvents.length === 0) return base;
    const auto = computeHourRange(weekGridEvents);
    return {
      startHour: Math.min(base.startHour, auto.startHour),
      endHour: Math.max(base.endHour, auto.endHour),
    };
  }, [weekGridEvents]);

  function shift(delta: number) {
    setAnchor((a) => (mode === "week" ? addDays(a, delta * 7) : addMonths(a, delta)));
  }

  const periodLabel =
    mode === "week"
      ? `${prettyDate(weekDates(anchor)[0], false)} – ${prettyDate(weekDates(anchor)[6])}`
      : monthLabel(anchor);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(today())}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 className="text-base font-semibold text-foreground">{periodLabel}</h2>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="calendar-tab"
              data-active={mode === "week"}
              onClick={() => setMode("week")}
            >
              Week
            </button>
            <button
              type="button"
              className="calendar-tab"
              data-active={mode === "month"}
              onClick={() => setMode("month")}
            >
              Month
            </button>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveDatesOpen(true)}
          >
            <CalendarRange className="h-4 w-4" />
            Active dates
          </Button>
          <Button size="sm" onClick={() => openNew(todayStr)}>
            <Plus className="h-4 w-4" />
            Event
          </Button>
        </div>
      </div>

      <div
        className={`min-h-0 flex-1 p-4 ${mode === "week" ? "overflow-hidden" : "overflow-auto"}`}
      >
        {mode === "week" ? (
          <TimeGrid
            days={weekDateList.map((date, i) => ({
              key: date,
              label: DOW_LABELS[i],
              sublabel: String(dayNumber(date)),
              isToday: date === todayStr,
            }))}
            events={weekGridEvents}
            range={weekRange}
            resolveColor={(type) =>
              colorForType(type, week.data?.colors, classToHex)
            }
            emptyHint="No events this week. Click a column to add one."
            onCellClick={(dayIndex) => openNew(weekDateList[dayIndex])}
            onEventClick={(ev) => {
              const meta = ev.meta as { date: string; event: MergedEvent };
              openEvent(meta.date, meta.event);
            }}
          />
        ) : (
          <div className="calendar-month">
            {DOW_LABELS.map((d) => (
              <div
                key={d}
                className="bg-card px-2 py-1 text-center text-xs font-medium text-muted-foreground"
              >
                {d}
              </div>
            ))}
            {cells.map((date) => {
              const bucket = range.data?.days?.[date];
              const events = bucket?.events ?? [];
              return (
                <div
                  key={date}
                  role="button"
                  tabIndex={0}
                  className="calendar-monthcell"
                  data-outside={monthOf(date) !== anchorMonth}
                  data-today={date === todayStr}
                  onClick={() => openNew(date)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openNew(date);
                    }
                  }}
                >
                  <span className="calendar-monthcell-num text-xs font-semibold">
                    {dayNumber(date)}
                  </span>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {events.slice(0, 4).map((ev, idx) => (
                      <EventChipMini
                        key={idx}
                        event={ev}
                        color={colorForType(ev.type, range.data?.colors, classToHex)}
                        onClick={() => openEvent(date, ev)}
                      />
                    ))}
                    {events.length > 4 ? (
                      <span className="text-[0.62rem] text-muted-foreground">
                        +{events.length - 4} more
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
