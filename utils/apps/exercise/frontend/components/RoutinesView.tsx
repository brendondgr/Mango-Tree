import { CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";
import { ConfirmDeleteButton } from "@exercise/components/ConfirmDeleteButton";
import {
  useDeleteRoutine,
  useRoutines,
  useWorkouts,
} from "@exercise/hooks/useExercise";
import { workoutColorClass } from "@exercise/utils/format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RoutinesView() {
  const routines = useRoutines();
  const workouts = useWorkouts();
  const deleteRoutine = useDeleteRoutine();

  const workout = (id: string) => workouts.data?.find((w) => w.id === id);

  if (routines.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading routines…</p>;
  }
  if (routines.isError) {
    return <p className="text-sm text-destructive">{(routines.error as Error).message}</p>;
  }
  const items = routines.data ?? [];

  return (
    <div className="ex-fade-in flex flex-col gap-6">
      <header>
        <h2 className="ex-gradient-text text-2xl font-bold tracking-tight">Your Routines</h2>
        <p className="text-sm text-muted-foreground">Weekly training schedules</p>
      </header>

      {items.length === 0 ? (
        <div className="ex-glass flex flex-col items-center gap-2 rounded-[var(--radius-lg)] p-10 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No routines yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {items.map((routine) => (
            <article key={routine.id} className="ex-glass rounded-[var(--radius-lg)] p-5">
              <header className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{routine.name}</h3>
                  {routine.description ? (
                    <p className="text-sm text-muted-foreground">{routine.description}</p>
                  ) : null}
                </div>
                <ConfirmDeleteButton
                  title="Delete routine?"
                  description={`"${routine.name}" will be removed.`}
                  onConfirm={() => deleteRoutine.mutate(routine.id)}
                  disabled={deleteRoutine.isPending}
                />
              </header>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {WEEKDAYS.map((day) => {
                  const ids = routine.workouts[day] ?? [];
                  return (
                    <div
                      key={day}
                      className="rounded-[var(--radius-md)] border border-border bg-[color-mix(in_srgb,hsl(var(--muted))_30%,transparent)] p-2"
                    >
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {day}
                      </p>
                      {ids.length === 0 ? (
                        <p className="text-xs text-muted-foreground/50">Rest</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {ids.map((id) => {
                            const w = workout(id);
                            return (
                              <li
                                key={id}
                                className={cn(
                                  "ex-railed flex items-center gap-1.5 truncate rounded-[var(--radius-sm)] border border-border bg-card py-1 pl-2.5 pr-1.5 text-xs text-foreground",
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
    </div>
  );
}
