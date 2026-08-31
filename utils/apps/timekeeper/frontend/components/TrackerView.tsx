import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { useIsNarrowPane } from "@/components/app-shell/MasterDetail";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { PaintPalette } from "@timekeeper/components/PaintPalette";
import { TrackerGrid, type GridMode } from "@timekeeper/components/TrackerGrid";
import { useCategories, useDayLogs, useSaveDay } from "@timekeeper/hooks/useTimekeeper";
import {
  BLOCKS_PER_HOUR,
  type Paint,
  indexToHHMM,
  logsToPaint,
  paintToIntervals,
  todayISO,
} from "@timekeeper/utils/blocks";
import { buildResolver, subcategoryColor } from "@timekeeper/utils/colors";
import { buildPaintOptions } from "@timekeeper/utils/paints";

export function TrackerView() {
  const setView = useWorkspaceStore((state) => state.setTimekeeperView);

  const [date, setDate] = useState(todayISO());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mode, setMode] = useState<GridMode>("paint");
  const [painted, setPainted] = useState<Record<number, Paint>>({});
  // Cleared as soon as the day is edited again, so "Day saved" can never sit
  // over a grid that no longer matches what was saved.
  const [savedNotice, setSavedNotice] = useState(false);

  const categoriesQuery = useCategories();
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const dayQuery = useDayLogs(date);
  const saveDay = useSaveDay();

  const resolver = useMemo(() => buildResolver(categories), [categories]);
  const options = useMemo(() => buildPaintOptions(categories), [categories]);
  // Derived rather than stored, so a paint whose subcategory was deleted in the
  // Categories tab cannot linger as a selection that paints nothing.
  const activeOption = useMemo(
    () => options.find((option) => option.id === activeId) ?? null,
    [options, activeId],
  );

  const [paneRef, isNarrowPane] = useIsNarrowPane<HTMLDivElement>();
  const helpId = useId();
  const dayLogs = dayQuery.data;

  // Load the selected day's logs into the paint grid whenever they change.
  useEffect(() => {
    if (dayLogs) {
      setPainted(Object.fromEntries(logsToPaint(dayLogs)));
    }
  }, [dayLogs]);

  const paintRange = useCallback(
    (from: number, to: number, rangeMode: GridMode) => {
      setSavedNotice(false);
      const low = Math.min(from, to);
      const high = Math.max(from, to);
      setPainted((prev) => {
        const next = { ...prev };
        let changed = false;
        for (let index = low; index <= high; index += 1) {
          if (rangeMode === "erase") {
            if (index in next) {
              delete next[index];
              changed = true;
            }
          } else if (activeOption) {
            const current = next[index];
            if (
              !current ||
              current.subcategory_id !== activeOption.paint.subcategory_id ||
              current.category_id !== activeOption.paint.category_id
            ) {
              next[index] = activeOption.paint;
              changed = true;
            }
          }
        }
        // Returning the previous object when a drag re-enters a block it has
        // already painted keeps the 288-cell grid from re-rendering per move.
        return changed ? next : prev;
      });
    },
    [activeOption],
  );

  const colorFor = useCallback(
    (index: number): string | undefined => {
      const paint = painted[index];
      if (!paint) return undefined;
      const sub = paint.subcategory_id ? resolver.bySub.get(paint.subcategory_id) : undefined;
      return sub ? subcategoryColor(sub.cat.colorId, sub.sub.l) : undefined;
    },
    [painted, resolver],
  );

  const describe = useCallback(
    (index: number): string => {
      const time = indexToHHMM(index);
      const paint = painted[index];
      if (!paint) return `${time}, empty`;
      const resolved = resolver.resolve(paint.category_id, paint.subcategory_id);
      const name = resolved.subcategoryName
        ? `${resolved.categoryName} · ${resolved.subcategoryName}`
        : resolved.categoryName;
      return `${time}, ${name}`;
    },
    [painted, resolver],
  );

  const isPainted = useCallback((index: number) => Boolean(painted[index]), [painted]);

  function submit() {
    const intervals = paintToIntervals(
      new Map(Object.entries(painted).map(([key, value]) => [Number(key), value])),
    );
    saveDay.mutate({ date, intervals }, { onSuccess: () => setSavedNotice(true) });
  }

  const paintedCount = Object.keys(painted).length;
  const modeLabel =
    mode === "erase"
      ? "Erasing"
      : activeOption
        ? `Painting ${activeOption.label}`
        : "No paint selected";

  return (
    <div
      ref={paneRef}
      className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 @[34rem]:p-4 @[60rem]:p-6"
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Day to track" hideLabel className="w-40">
          <Input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setSavedNotice(false);
            }}
          />
        </Field>
        {dayQuery.isFetching && (
          <span className="flex h-9 items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading day…
          </span>
        )}
        <p
          aria-live="polite"
          className="ml-auto text-sm tabular-nums text-muted-foreground"
        >
          {paintedCount} block{paintedCount === 1 ? "" : "s"} ·{" "}
          {((paintedCount * 5) / 60).toFixed(1)}h painted
        </p>
      </div>

      {/* The palette has to sit INSIDE a boundary too. Rendered outside one it
          saw `options === []` for as long as the categories request was in
          flight and asserted "No paints yet" at every user with paints, which
          is the exact flash AsyncBoundary exists to prevent. The day query
          keeps its own inner boundary so changing the date reloads the grid
          without blanking the palette. */}
      <AsyncBoundary
        loading={categoriesQuery.isLoading}
        error={categoriesQuery.error}
        onRetry={() => void categoriesQuery.refetch()}
        label="your paints"
        skeleton={<TrackerSkeleton />}
        className="flex flex-col gap-4"
      >
        <PaintPalette
          options={options}
          activeId={activeOption?.id ?? null}
          onSelect={(option) => {
            setActiveId(option.id);
            setMode("paint");
          }}
          mode={mode}
          onModeChange={setMode}
          narrow={isNarrowPane}
          onManageCategories={() => setView("categories")}
        />

        <section
          aria-label="Day timeline"
          className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-3 shadow-xs @[34rem]:p-4"
        >
          <p id={helpId} className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{modeLabel}.</span> Click or
            drag to paint. Arrow keys move through the day, Space or Enter paints the
            focused block, Shift with an arrow paints a whole range, and Delete erases.
          </p>

          <AsyncBoundary
            loading={dayQuery.isLoading}
            error={dayQuery.error}
            onRetry={() => void dayQuery.refetch()}
            label="the day's tracked time"
            skeleton={<GridSkeleton />}
          >
            <div className="scroll-region">
              <TrackerGrid
                describe={describe}
                colorFor={colorFor}
                isPainted={isPainted}
                mode={mode}
                canPaint={Boolean(activeOption)}
                onPaintRange={paintRange}
                describedBy={helpId}
              />
            </div>
          </AsyncBoundary>
        </section>
      </AsyncBoundary>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background/95 py-2 backdrop-blur-sm">
        {saveDay.isError && (
          <p role="alert" className="mr-auto text-sm text-destructive">
            {(saveDay.error as Error).message}
          </p>
        )}
        {savedNotice && !saveDay.isPending && (
          <p role="status" className="mr-auto text-sm text-muted-foreground">
            Day saved.
          </p>
        )}
        <Button
          variant="outline"
          onClick={() => {
            setPainted({});
            setSavedNotice(false);
          }}
        >
          <Trash2 className="h-4 w-4" />
          Clear
        </Button>
        <Button onClick={submit} disabled={saveDay.isPending}>
          {saveDay.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          Submit day
        </Button>
      </div>
    </div>
  );
}

/** Palette + timeline placeholder, shape-matched to what replaces it. */
function TrackerSkeleton() {
  return (
    <>
      <div
        aria-hidden
        className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-3 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-11 w-44 rounded-[var(--radius-md)]" />
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Literal class strings: Tailwind scans source statically, so a
              `w-${n}` template would emit no width rule at all. */}
          {["w-28", "w-20", "w-32", "w-24"].map((width) => (
            <Skeleton key={width} className={`h-9 rounded-[var(--radius-pill)] ${width}`} />
          ))}
        </div>
      </div>
      <div
        aria-hidden
        className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-3 shadow-xs @[34rem]:p-4"
      >
        <Skeleton className="h-8 w-full" />
        <GridSkeleton />
      </div>
    </>
  );
}

function GridSkeleton() {
  return (
    <div className="flex flex-col gap-0.5" aria-hidden>
      {Array.from({ length: 24 }, (_, hour) => (
        <div
          key={hour}
          className="grid grid-cols-[3.25rem_repeat(12,minmax(0,1fr))] items-stretch gap-0.5"
        >
          <Skeleton className="h-7 @[44rem]:h-6" />
          {Array.from({ length: BLOCKS_PER_HOUR }, (_, column) => (
            <Skeleton key={column} className="h-7 @[44rem]:h-6" />
          ))}
        </div>
      ))}
    </div>
  );
}
