import { useEffect, useMemo, useState } from "react";
import { GripVertical, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useRoutines, useSaveRoutine, useWorkouts } from "@exercise/hooks/useExercise";
import { workoutColorClass } from "@exercise/utils/format";
import type { Routine } from "@/types/exercise";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function emptyWeek(): Record<string, string[]> {
  return { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
}

interface RoutineEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routine: Routine | null;
}

export function RoutineEditorDialog({ open, onOpenChange, routine }: RoutineEditorDialogProps) {
  const workouts = useWorkouts();
  const routines = useRoutines();
  const save = useSaveRoutine();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string[]>>(emptyWeek);
  const [search, setSearch] = useState("");
  const [overDay, setOverDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(routine?.name ?? "");
    setDescription(routine?.description ?? "");
    setAssignments({ ...emptyWeek(), ...(routine?.workouts ?? {}) });
    setSearch("");
    setError(null);
  }, [open, routine]);

  const byId = useMemo(
    () => new Map((workouts.data ?? []).map((w) => [w.id, w])),
    [workouts.data],
  );

  const library = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (workouts.data ?? [])
      .filter((w) => w.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [workouts.data, search]);

  const addToDay = (day: string, workoutId: string) => {
    setAssignments((prev) => {
      if (prev[day]?.includes(workoutId)) return prev;
      return { ...prev, [day]: [...(prev[day] ?? []), workoutId] };
    });
  };
  const removeFromDay = (day: string, index: number) =>
    setAssignments((prev) => ({ ...prev, [day]: prev[day].filter((_, i) => i !== index) }));

  const existingNames = useMemo(
    () =>
      new Set(
        (routines.data ?? [])
          .filter((r) => r.id !== routine?.id)
          .map((r) => r.name.trim().toLowerCase()),
      ),
    [routines.data, routine?.id],
  );

  const handleSave = () => {
    setError(null);
    if (!name.trim()) {
      setError("Please give the routine a name.");
      return;
    }
    if (existingNames.has(name.trim().toLowerCase())) {
      setError("A routine with that name already exists.");
      return;
    }
    const payload: Routine = {
      id: routine?.id ?? `rt_${Date.now()}`,
      name: name.trim(),
      description: description.trim() || null,
      workouts: assignments,
    };
    save.mutate(payload, {
      onSuccess: () => onOpenChange(false),
      onError: (err) => setError((err as Error).message),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="exercise-app max-w-3xl">
        <DialogHeader>
          <DialogTitle>{routine ? "Edit Routine" : "New Routine"}</DialogTitle>
          <DialogDescription>
            Drag workouts from the library onto the days you want to train.
          </DialogDescription>
        </DialogHeader>

        <div className="exercise-scroll -mr-2 max-h-[64vh] space-y-5 overflow-y-auto pr-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rt-name">Routine name</Label>
              <Input
                id="rt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Push / Pull / Legs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rt-desc">Description</Label>
              <Input
                id="rt-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Workout library */}
          <div className="space-y-2">
            <Label>Workout library</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search workouts…"
                className="pl-9"
              />
            </div>
            <div className="exercise-scroll flex max-h-28 flex-wrap gap-2 overflow-y-auto">
              {library.length === 0 ? (
                <p className="text-xs text-muted-foreground">No matching workouts.</p>
              ) : (
                library.map((w) => {
                  const colorClass = workoutColorClass(w.color);
                  return (
                    <div
                      key={w.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", w.id)}
                      className={cn(
                        "exercise-grab exercise-railed inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-card py-1 pl-2.5 pr-2 text-xs font-medium text-foreground",
                        colorClass,
                      )}
                    >
                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                      {w.name}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Week grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                data-over={overDay === day}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverDay(day);
                }}
                onDragLeave={() => setOverDay((d) => (d === day ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverDay(null);
                  const id = e.dataTransfer.getData("text/plain");
                  if (id) addToDay(day, id);
                }}
                className="exercise-dropzone flex min-h-28 flex-col gap-1.5 p-2"
              >
                <p className="text-center text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                  {day}
                </p>
                {(assignments[day] ?? []).length === 0 ? (
                  <span className="flex flex-1 items-center justify-center text-[10px] text-muted-foreground/50">
                    Rest
                  </span>
                ) : (
                  (assignments[day] ?? []).map((wId, i) => {
                    const w = byId.get(wId);
                    const colorClass = workoutColorClass(w?.color);
                    return (
                      <div
                        key={`${wId}-${i}`}
                        className={cn(
                          "exercise-railed group flex items-center justify-between gap-1 rounded-[var(--radius-sm)] border border-border bg-card py-1 pl-2.5 pr-1 text-[11px] font-medium text-foreground",
                          colorClass,
                        )}
                      >
                        <span className="truncate">{w?.name ?? wId}</span>
                        <button
                          type="button"
                          aria-label="Remove"
                          onClick={() => removeFromDay(day, i)}
                          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-60 transition-opacity hover:text-destructive group-hover:opacity-100"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save Routine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
