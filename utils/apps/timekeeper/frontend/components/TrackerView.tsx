import { useEffect, useMemo, useRef, useState } from "react";
import { Eraser, Loader2, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Category } from "@/types/timekeeper";

import { useDayLogs, useSaveDay } from "@timekeeper/hooks/useTimekeeper";
import {
  BLOCKS_PER_HOUR,
  type Paint,
  indexToHHMM,
  logsToPaint,
  paintToIntervals,
  todayISO,
} from "@timekeeper/utils/blocks";
import { buildResolver, subcategoryColor } from "@timekeeper/utils/colors";

type DragMode = "paint" | "erase";

interface Props {
  categories: Category[];
}

export function TrackerView({ categories }: Props) {
  const [date, setDate] = useState(todayISO());
  const [active, setActive] = useState<Paint | null>(null);
  const [painted, setPainted] = useState<Record<number, Paint>>({});
  const dragRef = useRef<{ active: boolean; mode: DragMode }>({ active: false, mode: "paint" });

  const { data: dayLogs, isFetching } = useDayLogs(date);
  const saveDay = useSaveDay();
  const resolver = useMemo(() => buildResolver(categories), [categories]);

  // Load the selected day's logs into the paint grid whenever they change.
  useEffect(() => {
    if (dayLogs) {
      setPainted(Object.fromEntries(logsToPaint(dayLogs)));
    }
  }, [dayLogs]);

  useEffect(() => {
    const up = () => {
      dragRef.current.active = false;
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const paintedCount = Object.keys(painted).length;

  function apply(idx: number, mode: DragMode) {
    setPainted((prev) => {
      const next = { ...prev };
      if (mode === "erase") {
        delete next[idx];
      } else if (active) {
        next[idx] = active;
      }
      return next;
    });
  }

  function onBlockDown(idx: number, e: React.PointerEvent) {
    e.preventDefault();
    const mode: DragMode = e.button === 2 ? "erase" : "paint";
    if (mode === "paint" && !active) return;
    dragRef.current = { active: true, mode };
    apply(idx, mode);
  }

  function colorFor(p: Paint | undefined): string | undefined {
    if (!p) return undefined;
    const sub = p.subcategory_id ? resolver.bySub.get(p.subcategory_id) : undefined;
    if (sub) return subcategoryColor(sub.cat.colorId, sub.sub.l);
    return undefined;
  }

  function submit() {
    const intervals = paintToIntervals(new Map(Object.entries(painted).map(([k, v]) => [Number(k), v])));
    saveDay.mutate({ date, intervals });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 lg:p-6">
      {/* header: date + load */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Daily Tracker</h2>
          <p className="text-sm text-muted-foreground">
            Pick a paint, then drag to select 5-minute blocks. Right-click drag erases.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Day to track"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-40"
          />
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {/* paint palette */}
      <div className="timekeeper-card flex flex-wrap items-center gap-2 p-3">
        <span className="mr-1 text-xs font-semibold uppercase text-muted-foreground">
          Paint
        </span>
        {categories.length === 0 && (
          <span className="text-sm text-muted-foreground">
            No categories yet — add some in the Categories tab.
          </span>
        )}
        {categories.flatMap((cat) =>
          (cat.subcategories ?? []).map((sub) => {
            const isActive = active?.subcategory_id === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                className="timekeeper-pill"
                data-active={isActive}
                onClick={() => setActive({ category_id: cat.id, subcategory_id: sub.id })}
                title={`${cat.name} · ${sub.name}`}
              >
                <span
                  className="timekeeper-swatch"
                  style={{ background: subcategoryColor(cat.colorId, sub.l) }}
                />
                {cat.name} · {sub.name}
              </button>
            );
          }),
        )}
        {active && (
          <button
            type="button"
            className="timekeeper-pill ml-auto"
            onClick={() => setActive(null)}
            title="Deselect paint (then right-drag or use Eraser)"
          >
            <Eraser className="h-3.5 w-3.5" /> Erase mode
          </button>
        )}
      </div>

      {/* grid */}
      <div
        className="timekeeper-card timekeeper-grid p-4"
        onContextMenu={(e) => e.preventDefault()}
      >
        {Array.from({ length: 24 }, (_, hour) => (
          <div key={hour} className="timekeeper-grid-row">
            <div className="timekeeper-hour-label">{String(hour).padStart(2, "0")}:00</div>
            {Array.from({ length: BLOCKS_PER_HOUR }, (_, col) => {
              const idx = hour * BLOCKS_PER_HOUR + col;
              const p = painted[idx];
              const bg = colorFor(p);
              return (
                <div
                  key={idx}
                  className="timekeeper-block"
                  data-painted={Boolean(p)}
                  style={bg ? { background: bg } : undefined}
                  title={indexToHHMM(idx)}
                  onPointerDown={(e) => onBlockDown(idx, e)}
                  onPointerEnter={() => {
                    if (dragRef.current.active) apply(idx, dragRef.current.mode);
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* actions */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">
          {paintedCount} block{paintedCount === 1 ? "" : "s"} ·{" "}
          {((paintedCount * 5) / 60).toFixed(1)}h painted
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPainted({})}>
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
          <Button onClick={submit} disabled={saveDay.isPending}>
            {saveDay.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Submit day
          </Button>
        </div>
      </div>
      {saveDay.isError && (
        <p className="text-sm text-destructive">{(saveDay.error as Error).message}</p>
      )}
    </div>
  );
}
