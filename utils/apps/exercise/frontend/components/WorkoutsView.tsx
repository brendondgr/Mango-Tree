import { Dumbbell } from "lucide-react";

import { cn } from "@/lib/utils";
import { ConfirmDeleteButton } from "@exercise/components/ConfirmDeleteButton";
import { useDeleteWorkout, useWorkouts } from "@exercise/hooks/useExercise";
import { workoutColorClass } from "@exercise/utils/format";

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

  return (
    <div className="exercise-fade-in flex flex-col gap-6">
      <header>
        <h2 className="exercise-gradient-text text-2xl font-bold tracking-tight">Your Workouts</h2>
        <p className="text-sm text-muted-foreground">Your custom workout programs</p>
      </header>

      {items.length === 0 ? (
        <div className="exercise-glass flex flex-col items-center gap-2 rounded-[var(--radius-lg)] p-10 text-center">
          <Dumbbell className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No workout templates yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((workout) => {
            const colorClass = workoutColorClass(workout.color);
            return (
              <article
                key={workout.id}
                className={cn(
                  "exercise-glass exercise-card exercise-railed flex flex-col gap-4 rounded-[var(--radius-lg)] p-5 pl-6",
                  colorClass,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("exercise-badge", colorClass)}>
                    {workout.exercises.length} Exercise{workout.exercises.length === 1 ? "" : "s"}
                  </span>
                  <ConfirmDeleteButton
                    title="Delete workout?"
                    description={`"${workout.name}" will be removed. This cannot be undone.`}
                    onConfirm={() => deleteWorkout.mutate(workout.id)}
                    disabled={deleteWorkout.isPending}
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">{workout.name}</h3>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {workout.exercises.map((e) => e.name).join(", ") || "No exercises"}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
