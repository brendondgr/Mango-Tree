import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ListTodo,
  Plus,
  Trash2,
} from "lucide-react";

import * as api from "@/services/calendarClient";
import { AppHeader } from "@/components/app-shell/AppHeader";
import {
  MasterDetail,
  useIsNarrowPane,
} from "@/components/app-shell/MasterDetail";
import {
  SegmentedControl,
  type Segment,
} from "@/components/app-shell/SegmentedControl";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonList } from "@/components/ui/skeleton";
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
import { buildColorIndex, categoryStyle, colorForType } from "../utils/colors";
import { DOW_LABELS } from "../utils/dates";
import type { GridEvent } from "../utils/timegrid";
import { CategoryEditor } from "./CategoryEditor";
import { ConfirmDialog } from "./ConfirmDialog";
import { ScheduleEventDialog } from "./ScheduleEventDialog";
import { TimeGrid } from "./TimeGrid";

type Span = "1" | "3" | "7";

const SPANS: Segment<Span>[] = [
  { value: "1", label: "Day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "Week" },
];

/**
 * Detail-column width at which seven legible day columns still fit: TimeGrid's
 * own minimum (a 52px time gutter plus seven 96px day columns inside a 1px
 * border) plus the 1rem of padding the scroll area adds either side.
 */
const WEEK_FITS_PX = 52 + 7 * 96 + 2 + 32;

/**
 * Inline width of an element, `null` until a measurement has actually landed.
 *
 * `useIsNarrowPane` answers with a boolean that starts `false`, i.e. "wide", so
 * on the first commit — before any ResizeObserver callback has run — a mount
 * effect that trusts it is deciding against a guess. A callback ref rather than
 * an object ref because the measured node can mount later than the component:
 * the detail column only exists once its query resolves.
 */
function useInlineWidth<T extends HTMLElement>(): [
  (node: T | null) => void,
  number | null,
] {
  const [width, setWidth] = useState<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    if (typeof ResizeObserver === "undefined") {
      setWidth(node.getBoundingClientRect().width);
      return;
    }
    observer.current = new ResizeObserver(([entry]) => {
      setWidth(entry.contentRect.width);
    });
    observer.current.observe(node);
  }, []);

  return [ref, width];
}

function stripExt(file: string): string {
  return file.replace(/\.json$/, "");
}

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
  const [paneRef, isNarrow] = useIsNarrowPane<HTMLDivElement>();
  const [paneMeasureRef, paneWidth] = useInlineWidth<HTMLDivElement>();
  const [detailMeasureRef, detailWidth] = useInlineWidth<HTMLDivElement>();
  // Tri-state: `null` until the pane has been measured at all. `isNarrow`
  // alone cannot say "not yet", and mount effects run before the first
  // ResizeObserver callback.
  const narrowPane: boolean | null = paneWidth == null ? null : isNarrow;
  // Stable, so the pane is not re-observed on every render: an inline ref
  // callback changes identity each time and React would detach and re-attach
  // both refs with it.
  const paneRootRef = useCallback(
    (node: HTMLDivElement | null) => {
      paneRef.current = node;
      paneMeasureRef(node);
    },
    [paneRef, paneMeasureRef],
  );

  const schedules = useSchedules();
  const palette = usePalette();

  const [selected, setSelected] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDefaults, setAddDefaults] = useState<{ day: number; start: string }>({
    day: 0,
    start: "09:00",
  });
  const [showHours, setShowHours] = useState(false);
  const [span, setSpan] = useState<Span>("3");
  const [dayStart, setDayStart] = useState(0);
  const [confirmSchedule, setConfirmSchedule] = useState(false);
  const [confirmEvent, setConfirmEvent] = useState<ScheduleEvent | null>(null);
  const [busy, setBusy] = useState(false);

  // Only auto-open a schedule when both columns are on screen. On a narrow pane
  // MasterDetail shows the detail *instead of* the list, so selecting for the
  // user would drop them into an editor they never asked for and hide the list
  // they were about to read.
  // `!== false` and not `!narrowPane`: with a warm cache the data is present on
  // the very first commit, and treating "not measured yet" as "wide" is what
  // dropped a narrow-pane user straight into an editor on returning to the tab.
  useEffect(() => {
    if (narrowPane !== false) return;
    if (selected == null && schedules.data && schedules.data.length > 0) {
      setSelected(schedules.data[0]);
    }
  }, [schedules.data, selected, narrowPane]);

  const detail = useScheduleDetail(selected);
  const deleteSchedule = useDeleteSchedule();
  const deleteEvent = useDeleteScheduleEvent(selected ?? "");
  const updateColors = useUpdateColorMappings(selected ?? "");
  const renameCategory = useRenameCategory(selected ?? "");

  const colorIndex = useMemo(() => buildColorIndex(palette.data ?? []), [palette.data]);

  const types = detail.data ? Object.keys(detail.data.colors).sort() : [];

  // Gated on the detail column, not the pane: the timeline is inside the column
  // MasterDetail leaves after the 16rem list, so a pane just over the narrow
  // boundary still has a column too small for seven days. Measuring the pane
  // forced span 7 and hid the control, leaving a week grid that could only
  // side-scroll. Unmeasured reads as "fits" so the wide case does not flash.
  const fitsWeek = detailWidth == null || detailWidth >= WEEK_FITS_PX;
  const spanDays = fitsWeek ? 7 : Number(span);
  // A short window must still be able to reach Sunday, so it slides across the
  // week rather than being pinned to Monday.
  const windowStart = Math.min(dayStart, 7 - spanDays);
  const visibleDays = useMemo(
    () =>
      Array.from({ length: spanDays }, (_, i) => ({
        key: DOW_LABELS[windowStart + i],
        label: DOW_LABELS[windowStart + i],
      })),
    [spanDays, windowStart],
  );

  // Expanded schedule events → timeline events (day index is 0=Mon..6=Sun).
  const gridEvents = useMemo<GridEvent[]>(() => {
    const out: GridEvent[] = [];
    for (const ev of detail.data?.schedule.events ?? []) {
      if (typeof ev.day !== "number" || !ev.start || !ev.end) continue;
      out.push({
        dayIndex: ev.day - windowStart,
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
  }, [detail.data, windowStart]);

  async function handlePrint() {
    if (!selected) return;
    try {
      const blob = await api.printSchedule(selected, {
        timeRange: { startHour: 6, endHour: 23 },
        daysRange: null,
        hiddenCategories: [],
      });
      const name = detail.data?.schedule.name ?? stripExt(selected);
      downloadBlob(blob, `${name}.pdf`);
    } catch {
      /* surfaced by the button state; no-op */
    }
  }

  async function confirmDeleteSchedule() {
    if (!selected) return;
    setBusy(true);
    try {
      await deleteSchedule.mutateAsync(selected);
      setSelected(null);
      setConfirmSchedule(false);
    } finally {
      setBusy(false);
    }
  }

  function confirmDeleteEvent() {
    const ev = confirmEvent;
    if (!ev || ev._original_idx == null) return;
    deleteEvent.mutate(ev._original_idx);
    setConfirmEvent(null);
  }

  const list = (
    <div className="flex min-h-0 flex-1 flex-col">
      <h3 className="shrink-0 px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Schedules
      </h3>
      <AsyncBoundary
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
        label="schedules"
        loading={schedules.isPending}
        error={schedules.error}
        empty={schedules.data?.length === 0}
        onRetry={() => void schedules.refetch()}
        skeleton={<SkeletonList count={4} className="px-1" />}
        emptyIcon={ListTodo}
        emptyTitle="No schedules yet"
        emptyDescription="Schedules hold the recurring week that the calendar maps onto dates."
      >
        <ul className="flex flex-col gap-0.5">
          {(schedules.data ?? []).map((file, idx) => (
            <li key={file} data-enter style={{ "--i": idx } as never}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-md)] px-2.5 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring app:min-h-9 data-[active=true]:bg-secondary data-[active=true]:font-medium data-[active=true]:text-foreground"
                data-active={file === selected}
                aria-current={file === selected ? "true" : undefined}
                onClick={() => setSelected(file)}
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{stripExt(file)}</span>
              </button>
            </li>
          ))}
        </ul>
      </AsyncBoundary>
    </div>
  );

  const detailPane =
    selected == null ? (
      <EmptyState
        icon={ListTodo}
        title="No schedule selected"
        description="Pick a schedule to edit its weekly grid, categories and hours."
      />
    ) : (
      <AsyncBoundary
        className="flex min-h-0 flex-1 flex-col"
        label="this schedule"
        loading={detail.isPending}
        error={detail.error}
        onRetry={() => void detail.refetch()}
        skeleton={
          <div className="space-y-3 p-4">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-[22rem] w-full rounded-[var(--radius-md)]" />
          </div>
        }
      >
        {detail.data ? (
          // A second query container: the timeline below sizes against the
          // DETAIL column, not the whole pane, so opening the chat sidebar
          // reflows it the way narrowing the window does.
          <div
            ref={detailMeasureRef}
            className="flex min-h-0 flex-1 flex-col"
            style={{ containerType: "inline-size" }}
          >
            <AppHeader
              icon={FileText}
              title={detail.data.schedule.name}
              description={detail.data.schedule.description || undefined}
              actions={
                <>
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
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmSchedule(true)}
                    disabled={busy}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </>
              }
            />

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Categories
                  </span>
                  {types.map((type) => (
                    <CategoryEditor
                      key={type}
                      type={type}
                      color={colorForType(type, detail.data!.colors, colorIndex)}
                      currentColorName={
                        detail.data!.schedule.color_mappings[type] ?? ""
                      }
                      palette={palette.data ?? []}
                      busy={renameCategory.isPending || updateColors.isPending}
                      compact={isNarrow}
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

                {!fitsWeek ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <SegmentedControl
                      segments={SPANS}
                      value={span}
                      onValueChange={setSpan}
                      label="Days shown"
                    />
                    {spanDays < 7 ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Earlier days"
                          disabled={windowStart === 0}
                          onClick={() => setDayStart((d) => Math.max(0, d - spanDays))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Later days"
                          disabled={windowStart >= 7 - spanDays}
                          onClick={() =>
                            setDayStart((d) => Math.min(7 - spanDays, d + spanDays))
                          }
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="h-[26rem] @[36rem]:h-[32rem] @[56rem]:h-[38rem]">
                  <TimeGrid
                    label={`Weekly grid for ${detail.data.schedule.name}`}
                    days={visibleDays}
                    events={gridEvents}
                    hourHeight={isNarrow ? 64 : 52}
                    minDayWidth={spanDays === 1 ? 160 : spanDays === 3 ? 88 : 96}
                    resolveColor={(type) =>
                      colorForType(type, detail.data!.colors, colorIndex)
                    }
                    emptyHint="No events yet. Pick a column to add one."
                    onCellClick={(dayIndex, time) => {
                      setAddDefaults({ day: windowStart + dayIndex, start: time });
                      setAddOpen(true);
                    }}
                    isEventActionable={(ev) =>
                      (ev.meta as ScheduleEvent)._original_idx != null
                    }
                    onEventClick={(ev) => setConfirmEvent(ev.meta as ScheduleEvent)}
                  />
                </div>

                <section>
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-1.5 rounded-[var(--radius-sm)] text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring app:min-h-9"
                    onClick={() => setShowHours((v) => !v)}
                    aria-expanded={showHours}
                  >
                    <ChevronDown
                      className="h-4 w-4 transition-transform duration-[var(--motion-duration-sm)] ease-[var(--motion-ease-standard)]"
                      style={{ transform: showHours ? "none" : "rotate(-90deg)" }}
                    />
                    Weekly hours
                    <span className="font-normal text-muted-foreground">
                      {detail.data.stats.total.toFixed(1)}h total
                    </span>
                  </button>
                  {showHours ? (
                    <ul className="mt-2 grid gap-2 @[36rem]:grid-cols-2 @[36rem]:gap-x-6">
                      {Object.entries(detail.data.stats.by_category)
                        .filter(([, hrs]) => hrs > 0)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, hrs], idx) => {
                          const pct = detail.data!.stats.total
                            ? (hrs / detail.data!.stats.total) * 100
                            : 0;
                          return (
                            <li
                              key={cat}
                              className="text-sm"
                              data-enter
                              style={{ "--i": idx } as never}
                            >
                              <div className="flex justify-between gap-2">
                                <span className="truncate capitalize text-foreground">
                                  {cat}
                                </span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">
                                  {hrs.toFixed(1)}h
                                </span>
                              </div>
                              <div className="mt-1 h-2 overflow-hidden rounded-[var(--radius-pill)] bg-muted">
                                {/* The bar carries the same category color the
                                    grid paints, so the breakdown and the
                                    timeline read as one legend. */}
                                <div
                                  className="calendar-solid h-full rounded-[var(--radius-pill)] motion-safe:transition-[width] motion-safe:duration-[var(--motion-duration-lg)] motion-safe:ease-[var(--motion-ease-standard)]"
                                  style={categoryStyle(
                                    colorForType(cat, detail.data!.colors, colorIndex),
                                    { width: `${pct}%` },
                                  )}
                                />
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                  ) : null}
                </section>
              </div>
            </div>
          </div>
        ) : null}
      </AsyncBoundary>
    );

  return (
    <div ref={paneRootRef} className="flex h-full min-h-0">
      <MasterDetail
        list={list}
        detail={detailPane}
        selected={selected != null}
        onBack={() => setSelected(null)}
        detailTitle={selected ? stripExt(selected) : undefined}
        listWidth="16rem"
      />

      {selected ? (
        <ScheduleEventDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          file={selected}
          defaultDay={addDefaults.day}
          defaultStart={addDefaults.start}
        />
      ) : null}

      <ConfirmDialog
        open={confirmSchedule}
        onOpenChange={setConfirmSchedule}
        title="Delete this schedule?"
        description={`"${selected ? stripExt(selected) : ""}" and every calendar date mapped to it will be removed. This cannot be undone.`}
        confirmLabel="Delete schedule"
        pending={busy}
        onConfirm={() => void confirmDeleteSchedule()}
      />

      <ConfirmDialog
        open={confirmEvent != null}
        onOpenChange={(open) => !open && setConfirmEvent(null)}
        title="Remove this event?"
        description={`"${confirmEvent?.title ?? ""}" will be removed from the schedule and from every date it maps to.`}
        confirmLabel="Remove event"
        pending={deleteEvent.isPending}
        onConfirm={confirmDeleteEvent}
      />
    </div>
  );
}
