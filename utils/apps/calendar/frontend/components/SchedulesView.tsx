import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, FileText, Plus, Trash2 } from "lucide-react";

import * as api from "@/services/calendarClient";
import { Button } from "@/components/ui/button";
import type { ScheduleEvent } from "@/types/calendar";

import {
  useDeleteSchedule,
  useDeleteScheduleEvent,
  usePalette,
  useRenameCategory,
  useScheduleDetail,
  useSchedules,
  useUpdateColorMappings,
} from "../hooks/useCalendar";
import { buildClassToHex, colorForType } from "../utils/colors";
import { DOW_LABELS } from "../utils/dates";
import type { GridEvent } from "../utils/timegrid";
import { CategoryEditor } from "./CategoryEditor";
import { ScheduleEventDialog } from "./ScheduleEventDialog";
import { TimeGrid } from "./TimeGrid";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function SchedulesView() {
  const schedules = useSchedules();
  const palette = usePalette();

  const [selected, setSelected] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDefaults, setAddDefaults] = useState<{ day: number; start: string }>({
    day: 0,
    start: "09:00",
  });
  const [showHours, setShowHours] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (selected == null && schedules.data && schedules.data.length > 0) {
      setSelected(schedules.data[0]);
    }
  }, [schedules.data, selected]);

  const detail = useScheduleDetail(selected);
  const deleteSchedule = useDeleteSchedule();
  const deleteEvent = useDeleteScheduleEvent(selected ?? "");
  const updateColors = useUpdateColorMappings(selected ?? "");
  const renameCategory = useRenameCategory(selected ?? "");

  const classToHex = useMemo(
    () => buildClassToHex(palette.data ?? []),
    [palette.data],
  );

  const types = detail.data ? Object.keys(detail.data.colors).sort() : [];

  // Expanded schedule events → timeline events (day index is 0=Mon..6=Sun).
  const gridEvents = useMemo<GridEvent[]>(() => {
    const events = detail.data?.schedule.events ?? [];
    const out: GridEvent[] = [];
    for (const ev of events) {
      if (typeof ev.day !== "number" || !ev.start || !ev.end) continue;
      out.push({
        dayIndex: ev.day,
        start: ev.start,
        end: ev.end,
        title: ev.title,
        type: ev.type,
        sub: ev.sub,
        overwriteable: ev.overwriteable,
        meta: ev,
      });
    }
    return out;
  }, [detail.data]);

  async function handlePrint() {
    if (!selected) return;
    try {
      const blob = await api.printSchedule(selected, {
        timeRange: { startHour: 6, endHour: 23 },
        daysRange: null,
        hiddenCategories: [],
      });
      const name = detail.data?.schedule.name ?? selected.replace(".json", "");
      downloadBlob(blob, `${name}.pdf`);
    } catch {
      /* surfaced by the button state; no-op */
    }
  }

  async function handleDeleteSchedule() {
    if (!selected) return;
    if (!window.confirm(`Delete schedule "${selected}" and its calendar mappings?`)) return;
    setBusy(true);
    try {
      await deleteSchedule.mutateAsync(selected);
      setSelected(null);
    } finally {
      setBusy(false);
    }
  }

  function handleDeleteEvent(ev: ScheduleEvent) {
    if (ev._original_idx == null) return;
    if (!window.confirm(`Delete "${ev.title}" from the schedule?`)) return;
    deleteEvent.mutate(ev._original_idx);
  }

  return (
    <div className="flex h-full min-h-0">
      {/* schedule list */}
      <aside className="w-56 shrink-0 overflow-y-auto border-r border-border p-3">
        <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Schedules
        </h3>
        <ul className="flex flex-col gap-0.5">
          {(schedules.data ?? []).map((file) => (
            <li key={file}>
              <button
                type="button"
                className="calendar-tab w-full justify-start"
                data-active={file === selected}
                onClick={() => setSelected(file)}
              >
                <FileText className="h-4 w-4" />
                <span className="truncate">{file.replace(".json", "")}</span>
              </button>
            </li>
          ))}
          {schedules.data?.length === 0 ? (
            <li className="px-1 py-2 text-sm text-muted-foreground">No schedules yet.</li>
          ) : null}
        </ul>
      </aside>

      {/* detail */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!selected || !detail.data ? (
          <p className="text-sm text-muted-foreground">Select a schedule.</p>
        ) : (
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {detail.data.schedule.name}
                </h2>
                {detail.data.schedule.description ? (
                  <p className="text-sm text-muted-foreground">
                    {detail.data.schedule.description}
                  </p>
                ) : null}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Event
                </Button>
                <Button size="sm" variant="outline" onClick={handlePrint}>
                  <Download className="h-4 w-4" />
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDeleteSchedule}
                  disabled={busy}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* categories — above the grid; each opens a color/rename popover */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Categories
              </span>
              {types.map((type) => (
                <CategoryEditor
                  key={type}
                  type={type}
                  swatch={colorForType(type, detail.data!.colors, classToHex)}
                  currentColorName={detail.data!.schedule.color_mappings[type] ?? ""}
                  palette={palette.data ?? []}
                  busy={renameCategory.isPending || updateColors.isPending}
                  onPickColor={(name) =>
                    updateColors.mutate({
                      ...detail.data!.schedule.color_mappings,
                      [type]: name,
                    })
                  }
                  onRename={(newName) =>
                    renameCategory.mutate({ oldType: type, newType: newName })
                  }
                />
              ))}
            </div>

            {/* weekly grid (hour-by-hour timeline, honors overwriteable) */}
            <div className="h-[calc(100vh-16rem)] min-h-[34rem]">
              <TimeGrid
                days={DOW_LABELS.map((label) => ({ key: label, label }))}
                events={gridEvents}
                resolveColor={(type) =>
                  colorForType(type, detail.data!.colors, classToHex)
                }
                emptyHint="No events yet. Click a column to add one."
                onCellClick={(dayIndex, time) => {
                  setAddDefaults({ day: dayIndex, start: time });
                  setAddOpen(true);
                }}
                onEventClick={(ev) => handleDeleteEvent(ev.meta as ScheduleEvent)}
              />
            </div>

            {/* weekly hours — hidden by default, toggled open */}
            <section>
              <button
                type="button"
                className="flex w-full items-center gap-1.5 text-sm font-semibold text-foreground"
                onClick={() => setShowHours((v) => !v)}
                aria-expanded={showHours}
              >
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{ transform: showHours ? "none" : "rotate(-90deg)" }}
                />
                Weekly hours
                <span className="font-normal text-muted-foreground">
                  {detail.data.stats.total.toFixed(1)}h total
                </span>
              </button>
              {showHours ? (
                <ul className="mt-2 flex flex-col gap-1.5 sm:grid sm:grid-cols-2 sm:gap-x-6">
                  {Object.entries(detail.data.stats.by_category)
                    .filter(([, hrs]) => hrs > 0)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, hrs]) => {
                      const pct = detail.data!.stats.total
                        ? (hrs / detail.data!.stats.total) * 100
                        : 0;
                      return (
                        <li key={cat} className="text-sm">
                          <div className="flex justify-between">
                            <span className="capitalize text-foreground">{cat}</span>
                            <span className="text-muted-foreground">{hrs.toFixed(1)}h</span>
                          </div>
                          <div className="calendar-stat-bar">
                            <div className="calendar-stat-fill" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                </ul>
              ) : null}
            </section>
          </div>
        )}
      </div>

      {selected ? (
        <ScheduleEventDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          file={selected}
          defaultDay={addDefaults.day}
          defaultStart={addDefaults.start}
        />
      ) : null}
    </div>
  );
}
