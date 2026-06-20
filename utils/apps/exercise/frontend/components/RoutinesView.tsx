import { ConfirmDeleteButton } from "@exercise/components/ConfirmDeleteButton";
import {
  useDeleteRoutine,
  useRoutines,
  useWorkouts,
} from "@exercise/hooks/useExercise";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function RoutinesView() {
  const routines = useRoutines();
  const workouts = useWorkouts();
  const deleteRoutine = useDeleteRoutine();

  const workoutName = (id: string) =>
    workouts.data?.find((w) => w.id === id)?.name ?? id;

  if (routines.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading routines…</p>;
  }
  if (routines.isError) {
    return <p className="text-sm text-destructive">{(routines.error as Error).message}</p>;
  }
  const items = routines.data ?? [];
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No routines yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((routine) => (
        <article
          key={routine.id}
          className="rounded-[var(--radius-lg)] border border-border bg-card p-4"
        >
          <header className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-foreground">{routine.name}</h3>
              {routine.description ? (
                <p className="text-xs text-muted-foreground">{routine.description}</p>
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
                  className="rounded-[var(--radius-md)] border border-border/60 bg-background p-2"
                >
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{day}</p>
                  {ids.length === 0 ? (
                    <p className="text-xs text-muted-foreground/60">Rest</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {ids.map((id) => (
                        <li key={id} className="truncate text-xs text-foreground">
                          {workoutName(id)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}
