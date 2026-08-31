import { useState } from "react";
import { Dumbbell, Pencil, Play, Plus } from "lucide-react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { SkeletonGrid } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ConfirmDeleteButton } from "@exercise/components/ConfirmDeleteButton";
import { WorkoutEditorDialog } from "@exercise/components/WorkoutEditorDialog";
import { useDeleteWorkout, useWorkouts } from "@exercise/hooks/useExercise";
import { buildSession } from "@exercise/utils/session";
import { workoutColorClass } from "@exercise/utils/format";
import { CARD_INTERACTIVE } from "@exercise/utils/ui";
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
    <div className="flex flex-col gap-4 @[48rem]:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-foreground @[48rem]:text-2xl">
            Your Workouts
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your custom workout programs
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> New Workout
        </Button>
      </header>

      <AsyncBoundary
        loading={workouts.isLoading}
        error={workouts.error}
        empty={items.length === 0}
        onRetry={() => void workouts.refetch()}
        label="your workouts"
        skeleton={<SkeletonGrid count={3} />}
        emptyIcon={Dumbbell}
        emptyTitle="No workouts yet"
        emptyDescription="Create your first program, then start a session straight from its card."
        emptyAction={
          <Button onClick={openNew} variant="outline">
            <Plus className="h-4 w-4" /> New Workout
          </Button>
        }
      >
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,17rem),1fr))]">
          {items.map((workout, index) => {
            const colorClass = workoutColorClass(workout.color);
            const summary =
              workout.exercises.map((e) => e.name).join(", ") || "No exercises";
            return (
              <article
                key={workout.id}
                data-enter
                style={{ "--i": index } as never}
                className={cn(
                  CARD_INTERACTIVE,
                  "exercise-railed flex flex-col gap-3 p-4 pl-5",
                  colorClass,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("exercise-badge", colorClass)}>
                    {workout.exercises.length} Exercise
                    {workout.exercises.length === 1 ? "" : "s"}
                  </span>
                  <div className="flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${workout.name}`}
                      onClick={() => openEdit(workout)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ConfirmDeleteButton
                      title="Delete workout?"
                      description={`"${workout.name}" will be removed. This cannot be undone.`}
                      label={`Delete ${workout.name}`}
                      onConfirm={() => deleteWorkout.mutate(workout.id)}
                      disabled={deleteWorkout.isPending}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => openEdit(workout)}
                  className="rounded-[var(--radius-sm)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <h3 className="text-lg font-bold text-foreground">
                    {workout.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {summary}
                  </p>
                </button>

                <Button
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
      </AsyncBoundary>

      <WorkoutEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        workout={editing}
      />
    </div>
  );
}
