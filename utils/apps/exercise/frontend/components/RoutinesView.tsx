import { useState } from "react";
import { CalendarDays, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmDeleteButton } from "@exercise/components/ConfirmDeleteButton";
import { RoutineEditorDialog } from "@exercise/components/RoutineEditorDialog";
import {
  useDeleteRoutine,
  useRoutines,
  useWorkouts,
} from "@exercise/hooks/useExercise";
import { workoutColorClass } from "@exercise/utils/format";
import type { Routine } from "@/types/exercise";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RoutinesView() {
  const routines = useRoutines();
  const workouts = useWorkouts();
  const deleteRoutine = useDeleteRoutine();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Routine | null>(null);

  const workout = (id: string) => workouts.data?.find((w) => w.id === id);
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
          <p className="text-sm text-muted-foreground">Weekly training schedules</p>
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
        <div className="flex flex-col gap-5">
          {items.map((routine) => (
            <article key={routine.id} className="exercise-glass rounded-[var(--radius-lg)] p-5">
              <header className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{routine.name}</h3>
                  {routine.description ? (
                    <p className="text-sm text-muted-foreground">{routine.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit routine"
                    onClick={() => openEdit(routine)}
                  >
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
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {WEEKDAYS.map((day) => {
                  const ids = routine.workouts[day] ?? [];
                  return (
                    <div
                      key={day}
                      className="rounded-[var(--radius-md)] border border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,transparent)] p-2"
                    >
                      <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                        {day}
                      </p>
                      {ids.length === 0 ? (
                        <p className="text-center text-[10px] text-muted-foreground/50">Rest</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {ids.map((id, i) => {
                            const w = workout(id);
                            return (
                              <li
                                key={`${id}-${i}`}
                                className={cn(
                                  "exercise-railed truncate rounded-[var(--radius-sm)] border border-border bg-card py-1 pl-2.5 pr-1.5 text-[11px] text-foreground",
                                  workoutColorClass(w?.color),
                                )}
                              >
                                {w?.name ?? id}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}

      <RoutineEditorDialog open={editorOpen} onOpenChange={setEditorOpen} routine={editing} />
    </div>
  );
}
