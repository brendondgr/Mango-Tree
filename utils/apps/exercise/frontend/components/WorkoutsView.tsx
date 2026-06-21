import { useState } from "react";
import { Dumbbell, Pencil, Play, Plus } from "lucide-react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConfirmDeleteButton } from "@exercise/components/ConfirmDeleteButton";
import { WorkoutEditorDialog } from "@exercise/components/WorkoutEditorDialog";
import { useDeleteWorkout, useWorkouts } from "@exercise/hooks/useExercise";
import { buildSession } from "@exercise/utils/session";
import { workoutColorClass } from "@exercise/utils/format";
import type { Workout } from "@/types/exercise";

export function WorkoutsView() {
  const workouts = useWorkouts();
  const deleteWorkout = useDeleteWorkout();
  const startSession = useWorkspaceStore((s) => s.startExerciseSession);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Workout | null>(null);

  const openNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (workout: Workout) => {
    setEditing(workout);
    setEditorOpen(true);
  };

  const items = workouts.data ?? [];

  return (
    <div className="exercise-fade-in flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Your Workouts</h2>
          <p className="text-sm text-muted-foreground">Manage your custom workout programs</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> New Workout
        </Button>
      </header>

      {workouts.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading workouts…</p>
      ) : workouts.isError ? (
        <p className="text-sm text-destructive">{(workouts.error as Error).message}</p>
      ) : items.length === 0 ? (
        <div className="exercise-glass flex flex-col items-center gap-3 rounded-[var(--radius-lg)] p-10 text-center">
          <Dumbbell className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No workouts yet. Create your first program.</p>
          <Button onClick={openNew} variant="outline" size="sm">
            <Plus className="h-4 w-4" /> New Workout
          </Button>
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
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit workout"
                      onClick={() => openEdit(workout)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDeleteButton
                      title="Delete workout?"
                      description={`"${workout.name}" will be removed. This cannot be undone.`}
                      onConfirm={() => deleteWorkout.mutate(workout.id)}
                      disabled={deleteWorkout.isPending}
                    />
                  </div>
                </div>
                <button type="button" onClick={() => openEdit(workout)} className="text-left">
                  <h3 className="text-lg font-bold text-foreground">{workout.name}</h3>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {workout.exercises.map((e) => e.name).join(", ") || "No exercises"}
                  </p>
                </button>
                <Button
                  size="sm"
                  className="mt-auto w-full"
                  disabled={workout.exercises.length === 0}
                  onClick={() => startSession(buildSession(workout))}
                >
                  <Play className="h-4 w-4" /> Start
                </Button>
              </article>
            );
          })}
        </div>
      )}

      <WorkoutEditorDialog open={editorOpen} onOpenChange={setEditorOpen} workout={editing} />
    </div>
  );
}
