import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Plus, Trash2 } from "lucide-react";

import * as api from "@/services/calendarClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScheduleEvent } from "@/types/calendar";

import {
  useAddEntry,
  useConfig,
  useDeleteEntry,
  useDeleteSchedule,
  useDeleteScheduleEvent,
  usePalette,
  useScheduleDetail,
  useSchedules,
  useUpdateColorMappings,
} from "../hooks/useCalendar";
import { buildClassToHex, colorForType } from "../utils/colors";
import { DOW_LABELS } from "../utils/dates";
import type { GridEvent } from "../utils/timegrid";
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
  const config = useConfig();

  const [selected, setSelected] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDefaults, setAddDefaults] = useState<{ day: number; start: string }>({
    day: 0,
    start: "09:00",
  });
  const [entryStart, setEntryStart] = useState("");
  const [entryEnd, setEntryEnd] = useState("");
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
  const addEntry = useAddEntry();
  const deleteEntry = useDeleteEntry();

  const classToHex = useMemo(
    () => buildClassToHex(palette.data ?? []),
    [palette.data],
  );

  const entries = (config.data?.entries ?? []).map((e, i) => ({ ...e, _index: i }));
  const myEntries = entries.filter((e) => e.schedule_filename === selected);

  const types = detail.data ? Object.keys(detail.data.colors).sort() : [];
  const colorNames = (palette.data ?? []).map((c) => c.name);

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

  async function handleAddEntry() {
    if (!selected || !entryStart || !entryEnd) return;
    setBusy(true);
    try {
      await addEntry.mutateAsync({
        start_date: entryStart,
        end_date: entryEnd,
        schedule_filename: selected,
      });
      setEntryStart("");
      setEntryEnd("");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed to add mapping");
    } finally {
      setBusy(false);
    }
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

            {/* weekly grid (hour-by-hour timeline, honors overwriteable) */}
            <div className="h-[26rem] min-h-0">
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

            <div className="grid gap-5 md:grid-cols-2">
              {/* legend + color editing */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-foreground">Categories</h3>
                <ul className="flex flex-col gap-1.5">
                  {types.map((type) => {
                    const color = colorForType(type, detail.data!.colors, classToHex);
                    return (
                      <li key={type} className="flex items-center gap-2">
                        <span
                          className="calendar-legend-swatch"
                          style={{ background: color.bg, borderColor: color.border }}
                        />
                        <span className="flex-1 text-sm capitalize text-foreground">{type}</span>
                        <select
                          className="rounded-[var(--radius-sm)] border border-border bg-background px-2 py-1 text-xs"
                          value={detail.data!.schedule.color_mappings[type] ?? ""}
                          onChange={(e) =>
                            updateColors.mutate({
                              ...detail.data!.schedule.color_mappings,
                              [type]: e.target.value,
                            })
                          }
                        >
                          {colorNames.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* stats */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  Weekly hours
                  <span className="ml-2 font-normal text-muted-foreground">
                    {detail.data.stats.total.toFixed(1)}h total
                  </span>
                </h3>
                <ul className="flex flex-col gap-1.5">
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
              </section>
            </div>

            {/* calendar entries (date mappings) */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-foreground">Active dates</h3>
              <ul className="mb-2 flex flex-col gap-1">
                {myEntries.map((e) => (
                  <li
                    key={e._index}
                    className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-sm"
                  >
                    <span className="text-foreground">
                      {e.start_date} → {e.end_date}
                    </span>
                    <button
                      type="button"
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      onClick={() => deleteEntry.mutate(e._index)}
                      aria-label="Remove mapping"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
                {myEntries.length === 0 ? (
                  <li className="text-sm text-muted-foreground">
                    Not mapped to any dates yet.
                  </li>
                ) : null}
              </ul>
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  type="date"
                  className="w-40"
                  value={entryStart}
                  onChange={(e) => setEntryStart(e.target.value)}
                  aria-label="Start date"
                />
                <Input
                  type="date"
                  className="w-40"
                  value={entryEnd}
                  onChange={(e) => setEntryEnd(e.target.value)}
                  aria-label="End date"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddEntry}
                  disabled={busy || !entryStart || !entryEnd}
                >
                  Map dates
                </Button>
              </div>
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
