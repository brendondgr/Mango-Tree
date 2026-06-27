import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

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
import { DirectEventDialog } from "./DirectEventDialog";
import { EventBlock, EventChipMini } from "./EventBlock";

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
          <Button size="sm" onClick={() => openNew(todayStr)}>
            <Plus className="h-4 w-4" />
            Event
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {mode === "week" ? (
          <div className="calendar-week">
            {weekDates(anchor).map((date, i) => {
              const bucket = week.data?.days?.[date];
              const events = bucket?.events ?? [];
              return (
                <div key={date} className="calendar-daycol">
                  <div className="calendar-daycol-head" data-today={date === todayStr}>
                    <span className="text-xs font-medium text-muted-foreground">
                      {DOW_LABELS[i]}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {dayNumber(date)}
                    </span>
                  </div>
                  <div className="calendar-daycol-body">
                    {events.map((ev, idx) => (
                      <EventBlock
                        key={idx}
                        event={ev}
                        color={colorForType(ev.type, week.data?.colors, classToHex)}
                        onClick={() => openEvent(date, ev)}
                      />
                    ))}
                    <button
                      type="button"
                      className="mt-auto rounded-[var(--radius-sm)] py-1 text-xs text-muted-foreground hover:bg-muted"
                      onClick={() => openNew(date)}
                    >
                      + Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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
                <button
                  key={date}
                  type="button"
                  className="calendar-monthcell"
                  data-outside={monthOf(date) !== anchorMonth}
                  data-today={date === todayStr}
                  onClick={() => openNew(date)}
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
                </button>
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
    </div>
  );
}
