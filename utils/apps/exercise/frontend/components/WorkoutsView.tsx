import { ConfirmDeleteButton } from "@exercise/components/ConfirmDeleteButton";
import { useDeleteWorkout, useWorkouts } from "@exercise/hooks/useExercise";

export function WorkoutsView() {
  const workouts = useWorkouts();
  const deleteWorkout = useDeleteWorkout();

  if (workouts.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading workouts…</p>;
  }
  if (workouts.isError) {
    return <p className="text-sm text-destructive">{(workouts.error as Error).message}</p>;
  }
  const items = workouts.data ?? [];
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No workout templates yet.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((workout) => (
        <article
          key={workout.id}
          className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4"
        >
          <header className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-foreground">{workout.name}</h3>
              <p className="text-xs text-muted-foreground">
                {workout.exercises.length} exercise{workout.exercises.length === 1 ? "" : "s"}
              </p>
            </div>
            <ConfirmDeleteButton
              title="Delete workout?"
              description={`"${workout.name}" will be removed. This cannot be undone.`}
              onConfirm={() => deleteWorkout.mutate(workout.id)}
              disabled={deleteWorkout.isPending}
            />
          </header>
          <ul className="flex flex-col gap-1 text-sm text-foreground/80">
            {workout.exercises.slice(0, 6).map((exercise) => (
              <li key={exercise.id} className="flex justify-between gap-2">
                <span className="truncate">{exercise.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {exercise.sets}×{exercise.reps}
                  {exercise.weight ? ` @ ${exercise.weight}` : ""}
                </span>
              </li>
            ))}
            {workout.exercises.length > 6 ? (
              <li className="text-xs text-muted-foreground">
                +{workout.exercises.length - 6} more
              </li>
            ) : null}
          </ul>
        </article>
      ))}
    </div>
  );
}
