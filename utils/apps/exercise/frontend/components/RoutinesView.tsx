import { useState } from "react";
import { CalendarDays, Pencil, Play, Plus } from "lucide-react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmDeleteButton } from "@exercise/components/ConfirmDeleteButton";
import { RoutineEditorDialog } from "@exercise/components/RoutineEditorDialog";
import {
  useDeleteRoutine,
  useRoutines,
  useWorkouts,
} from "@exercise/hooks/useExercise";
import { buildSession } from "@exercise/utils/session";
import { workoutColorClass } from "@exercise/utils/format";
import type { Routine } from "@/types/exercise";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RoutinesView() {
  const routines = useRoutines();
  const workouts = useWorkouts();
  const deleteRoutine = useDeleteRoutine();
  const startSession = useWorkspaceStore((s) => s.startExerciseSession);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Routine | null>(null);

  const byId = (id: string) => workouts.data?.find((w) => w.id === id);
  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (routine: Routine) => {
    setEditing(routine);
    setEditorOpen(true);
  };

  const items = routines.data ?? [];

  return (
    <div className="exercise-fade-in flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Your Routines</h2>
          <p className="text-sm text-muted-foreground">
            Weekly schedules — click a workout to start a session
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> New Routine
        </Button>
      </header>

      {routines.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading routines…</p>
      ) : routines.isError ? (
        <p className="text-sm text-destructive">{(routines.error as Error).message}</p>
      ) : items.length === 0 ? (
        <div className="exercise-glass flex flex-col items-center gap-3 rounded-[var(--radius-lg)] p-10 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No routines yet. Build your first weekly schedule.</p>
          <Button onClick={openNew} variant="outline" size="sm">
            <Plus className="h-4 w-4" /> New Routine
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((routine) => (
            <article key={routine.id} className="exercise-glass rounded-[var(--radius-lg)] p-5">
              <header className="mb-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-foreground">{routine.name}</h3>
                  {routine.description ? (
                    <p className="truncate text-sm text-muted-foreground">{routine.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center">
                  <Button variant="ghost" size="icon" aria-label="Edit routine" onClick={() => openEdit(routine)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmDeleteButton
                    title="Delete routine?"
                    description={`"${routine.name}" will be removed.`}
                    onConfirm={() => deleteRoutine.mutate(routine.id)}
                    disabled={deleteRoutine.isPending}
                  />
                </div>
              </header>

              <div className="exercise-scroll overflow-x-auto">
                <div className="grid min-w-[640px] grid-cols-7 gap-2">
                  {WEEKDAYS.map((day) => {
                    const ids = routine.workouts[day] ?? [];
                    return (
                      <div key={day} className="flex flex-col gap-1.5">
                        <p className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                          {day}
                        </p>
                        {ids.length === 0 ? (
                          <span className="py-2 text-center text-xs text-muted-foreground/30">·</span>
                        ) : (
                          ids.map((id, i) => {
                            const w = byId(id);
                            return (
                              <button
                                key={`${id}-${i}`}
                                type="button"
                                title={w ? `Start ${w.name}` : id}
                                disabled={!w}
                                onClick={() => w && startSession(buildSession(w))}
                                className={cn(
                                  "exercise-railed group flex items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-card py-1 pl-2.5 pr-1 text-[11px] text-foreground transition-colors hover:border-primary",
                                  workoutColorClass(w?.color),
                                )}
                              >
                                <span className="flex-1 truncate text-left">{w?.name ?? id}</span>
                                <Play className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                              </button>
                            );
                          })
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <RoutineEditorDialog open={editorOpen} onOpenChange={setEditorOpen} routine={editing} />
    </div>
  );
}
