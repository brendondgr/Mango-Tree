import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, useFormErrors } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRoutines, useSaveRoutine, useWorkouts } from "@exercise/hooks/useExercise";
import { workoutColorClass } from "@exercise/utils/format";
import { CHIP } from "@exercise/utils/ui";
import type { Routine } from "@/types/exercise";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DAY_NAMES: Record<string, string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

function emptyWeek(): Record<string, string[]> {
  return { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
}

/** Shape-matched placeholder: two fields, the library strip, the week grid. */
function EditorSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 @[30rem]:grid-cols-2">
        <Skeleton className="h-16 rounded-[var(--radius-md)]" />
        <Skeleton className="h-16 rounded-[var(--radius-md)]" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-11 rounded-[var(--radius-md)] app:h-9" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-28" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 @[26rem]:grid-cols-2 @[38rem]:grid-cols-4 @[54rem]:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-[var(--radius-md)]" />
        ))}
      </div>
    </div>
  );
}

interface RoutineEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routine: Routine | null;
}

/**
 * Build a week of workouts.
 *
 * The builder used to be HTML5 drag-and-drop *only*. Touch browsers do not
 * synthesise drag events, so on a phone or tablet no workout could ever be
 * assigned to a day, and there was no keyboard path either. Every assignment,
 * reorder and move is now a menu command on a real button; the drag remains as
 * a pointer shortcut on top of it.
 */
export function RoutineEditorDialog({
  open,
  onOpenChange,
  routine,
}: RoutineEditorDialogProps) {
  const workouts = useWorkouts();
  const routines = useRoutines();
  const save = useSaveRoutine();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string[]>>(emptyWeek);
  const [search, setSearch] = useState("");
  const [overDay, setOverDay] = useState<string | null>(null);
  const { errors, formError, setFieldError, setFormError, clear } =
    useFormErrors<"name">();

  useEffect(() => {
    if (!open) return;
    setName(routine?.name ?? "");
    setDescription(routine?.description ?? "");
    setAssignments({ ...emptyWeek(), ...(routine?.workouts ?? {}) });
    setSearch("");
    clear();
  }, [open, routine, clear]);

  const byId = useMemo(
    () => new Map((workouts.data ?? []).map((w) => [w.id, w])),
    [workouts.data],
  );

  const all = useMemo(
    () => [...(workouts.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [workouts.data],
  );

  const library = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((w) => w.name.toLowerCase().includes(q));
  }, [all, search]);

  const addToDay = (day: string, workoutId: string) => {
    setAssignments((prev) => {
      if (prev[day]?.includes(workoutId)) return prev;
      return { ...prev, [day]: [...(prev[day] ?? []), workoutId] };
    });
  };

  const removeFromDay = (day: string, index: number) =>
    setAssignments((prev) => ({
      ...prev,
      [day]: prev[day].filter((_, i) => i !== index),
    }));

  /** Reorder within a day — the keyboard equivalent of dragging a chip up. */
  const moveWithinDay = (day: string, index: number, delta: number) =>
    setAssignments((prev) => {
      const list = [...(prev[day] ?? [])];
      const next = index + delta;
      if (next < 0 || next >= list.length) return prev;
      [list[index], list[next]] = [list[next], list[index]];
      return { ...prev, [day]: list };
    });

  /** Move an assignment to another day — the keyboard equivalent of a drag. */
  const moveToDay = (from: string, index: number, to: string) =>
    setAssignments((prev) => {
      if (from === to) return prev;
      const id = prev[from]?.[index];
      if (!id) return prev;
      const target = prev[to] ?? [];
      return {
        ...prev,
        [from]: prev[from].filter((_, i) => i !== index),
        [to]: target.includes(id) ? target : [...target, id],
      };
    });

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
    clear();
    if (!name.trim()) {
      setFieldError("name", "Please give the routine a name.");
      return;
    }
    if (existingNames.has(name.trim().toLowerCase())) {
      setFieldError("name", "A routine with that name already exists.");
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
      onError: (err) => setFormError((err as Error).message),
    });
  };

  const assignedCount = WEEKDAYS.reduce(
    (sum, day) => sum + (assignments[day]?.length ?? 0),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{routine ? "Edit Routine" : "New Routine"}</DialogTitle>
          <DialogDescription>
            Assign workouts to the days you want to train — use a workout&apos;s
            menu, or the <span className="font-medium">Add</span> button on a
            day. You can also drag a workout onto a day with a mouse.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* Query root for the week grid: the dialog is portalled outside the
              app pane, so it needs its own container. */}
          <div style={{ containerType: "inline-size" }}>
            {/* Both queries feed this editor — workouts fill the library and
                the day menus, routines back the duplicate-name check — so they
                get one boundary. Before it, an in-flight or failed fetch both
                rendered as "No workouts yet", and a failure left the day "Add"
                buttons disabled for good with nothing to retry. */}
            <AsyncBoundary
              loading={workouts.isLoading || routines.isLoading}
              error={workouts.error ?? routines.error}
              onRetry={() => {
                void workouts.refetch();
                void routines.refetch();
              }}
              label="the routine editor"
              skeleton={<EditorSkeleton />}
              className="space-y-5"
            >
              <div className="grid gap-3 @[30rem]:grid-cols-2">
                <Field label="Routine name" required error={errors.name}>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Push / Pull / Legs"
                  />
                </Field>
                <Field label="Description" hint="Optional">
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this routine for?"
                  />
                </Field>
              </div>

              {/* Workout library */}
              <section className="space-y-2">
                <h3 className="text-sm font-medium text-foreground">
                  Workout library
                </h3>
                <div className="relative">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={search}
                    aria-label="Search workouts"
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search workouts…"
                    className="pl-9"
                  />
                </div>

                {all.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No workouts yet — create one on the Workouts tab first.
                  </p>
                ) : library.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No workouts match “{search.trim()}”.
                  </p>
                ) : (
                  // Focusable, like the chart's scroll region: a region that
                  // scrolls has to be reachable and scrollable by keyboard.
                  <ul
                    aria-label="Workout library"
                    tabIndex={0}
                    className="scroll-region flex max-h-32 flex-wrap gap-2 overflow-y-auto"
                  >
                    {library.map((w) => (
                      <li
                        key={w.id}
                        className={cn(
                          "exercise-railed inline-flex items-center overflow-hidden",
                          "rounded-[var(--radius-sm)] border border-border bg-surface-1",
                          workoutColorClass(w.color),
                        )}
                      >
                        {/* Drag is a pointer shortcut only — it sits on its own
                            grip so it cannot fight the menu trigger for the
                            pointerdown. The menu below is the real path. */}
                        <span
                          draggable
                          aria-hidden
                          onDragStart={(e) =>
                            e.dataTransfer.setData("text/plain", w.id)
                          }
                          className="flex min-h-11 cursor-grab items-center pl-3 pr-1 text-muted-foreground active:cursor-grabbing app:min-h-8"
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                "flex min-h-11 items-center gap-1.5 pr-2 text-xs font-medium",
                                "text-foreground transition-colors hover:bg-surface-2",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                                "app:min-h-8",
                              )}
                            >
                              {w.name}
                              <ChevronDown
                                aria-hidden
                                className="h-3.5 w-3.5 text-muted-foreground"
                              />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuLabel>Add {w.name} to</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {WEEKDAYS.map((day) => (
                              <DropdownMenuItem
                                key={day}
                                onSelect={() => addToDay(day, w.id)}
                              >
                                <Plus aria-hidden />
                                {DAY_NAMES[day]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Week grid */}
              <section className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium text-foreground">Week</h3>
                  <p className="text-xs text-muted-foreground">
                    {assignedCount} assigned
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 @[26rem]:grid-cols-2 @[38rem]:grid-cols-4 @[54rem]:grid-cols-7">
                  {WEEKDAYS.map((day) => {
                    const ids = assignments[day] ?? [];
                    return (
                      <div
                        key={day}
                        data-over={overDay === day}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setOverDay(day);
                        }}
                        onDragLeave={() =>
                          setOverDay((d) => (d === day ? null : d))
                        }
                        onDrop={(e) => {
                          e.preventDefault();
                          setOverDay(null);
                          const id = e.dataTransfer.getData("text/plain");
                          if (id) addToDay(day, id);
                        }}
                        className={cn(
                          "flex min-h-28 flex-col gap-1.5 rounded-[var(--radius-md)] p-2",
                          "border border-dashed border-border transition-colors",
                          "duration-[var(--motion-duration-sm)] ease-[var(--motion-ease-standard)]",
                          "data-[over=true]:border-primary data-[over=true]:bg-primary/10",
                        )}
                      >
                        <p className="text-center text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">
                          {day}
                        </p>

                        {ids.length === 0 ? (
                          <span className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                            Rest
                          </span>
                        ) : (
                          <ul className="flex flex-col gap-1.5">
                            {ids.map((wId, i) => {
                              const w = byId.get(wId);
                              const label = w?.name ?? wId;
                              return (
                                <li key={`${wId}-${i}`}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        aria-label={`${label} on ${DAY_NAMES[day]} — open actions`}
                                        className={cn(
                                          CHIP,
                                          "justify-between pr-1.5",
                                          workoutColorClass(w?.color),
                                        )}
                                      >
                                        <span className="truncate">{label}</span>
                                        <MoreHorizontal
                                          aria-hidden
                                          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                        />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start">
                                      <DropdownMenuLabel className="max-w-56 truncate">
                                        {label}
                                      </DropdownMenuLabel>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        disabled={i === 0}
                                        onSelect={() => moveWithinDay(day, i, -1)}
                                      >
                                        <ChevronUp aria-hidden />
                                        Move up
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        disabled={i === ids.length - 1}
                                        onSelect={() => moveWithinDay(day, i, 1)}
                                      >
                                        <ChevronDown aria-hidden />
                                        Move down
                                      </DropdownMenuItem>
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                          Move to day
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuPortal>
                                          <DropdownMenuSubContent>
                                            {WEEKDAYS.filter(
                                              (d) => d !== day,
                                            ).map((d) => (
                                              <DropdownMenuItem
                                                key={d}
                                                onSelect={() =>
                                                  moveToDay(day, i, d)
                                                }
                                              >
                                                {DAY_NAMES[d]}
                                              </DropdownMenuItem>
                                            ))}
                                          </DropdownMenuSubContent>
                                        </DropdownMenuPortal>
                                      </DropdownMenuSub>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onSelect={() => removeFromDay(day, i)}
                                        className="text-destructive focus:text-destructive"
                                      >
                                        <Trash2 aria-hidden />
                                        Remove
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </li>
                              );
                            })}
                          </ul>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              disabled={all.length === 0}
                              aria-label={`Add a workout to ${DAY_NAMES[day]}`}
                              className={cn(
                                "mt-auto inline-flex min-h-11 w-full items-center justify-center gap-1",
                                "rounded-[var(--radius-sm)] border border-dashed border-border",
                                "text-xs font-medium text-muted-foreground transition-colors",
                                "hover:border-primary hover:text-foreground",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                "disabled:pointer-events-none disabled:opacity-50",
                                "app:min-h-8",
                              )}
                            >
                              <Plus aria-hidden className="h-3.5 w-3.5" />
                              Add
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="max-h-64 w-56 overflow-y-auto"
                          >
                            <DropdownMenuLabel>
                              Add to {DAY_NAMES[day]}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {library.length === 0 ? (
                              <DropdownMenuItem disabled>
                                No matching workouts
                              </DropdownMenuItem>
                            ) : (
                              library.map((w) => (
                                <DropdownMenuItem
                                  key={w.id}
                                  disabled={ids.includes(w.id)}
                                  onSelect={() => addToDay(day, w.id)}
                                >
                                  <span
                                    className={cn(
                                      "exercise-dot",
                                      workoutColorClass(w.color),
                                    )}
                                    aria-hidden
                                  />
                                  <span className="truncate">{w.name}</span>
                                </DropdownMenuItem>
                              ))
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    );
                  })}
                </div>
              </section>
            </AsyncBoundary>
          </div>
        </DialogBody>

        {formError ? (
          <p role="alert" className="shrink-0 text-sm text-destructive">
            {formError}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
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
