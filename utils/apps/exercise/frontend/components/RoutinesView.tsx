import { useState } from "react";
import { CalendarDays, Pencil, Play, Plus } from "lucide-react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { CARD, CHIP } from "@exercise/utils/ui";
import type { Routine } from "@/types/exercise";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES: Record<string, string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};

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
    <div className="flex flex-col gap-4 @[48rem]:gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-foreground @[48rem]:text-2xl">
            Your Routines
          </h2>
          <p className="text-sm text-muted-foreground">
            Weekly schedules — pick a workout to start a session
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4" /> New Routine
        </Button>
      </header>

      <AsyncBoundary
        loading={routines.isLoading}
        error={routines.error}
        empty={items.length === 0}
        onRetry={() => void routines.refetch()}
        label="your routines"
        skeleton={
          <div className="flex flex-col gap-4">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-48 rounded-[var(--radius-lg)]" />
            ))}
          </div>
        }
        emptyIcon={CalendarDays}
        emptyTitle="No routines yet"
        emptyDescription="Build a weekly schedule from the workouts you have already created."
        emptyAction={
          <Button onClick={openNew} variant="outline">
            <Plus className="h-4 w-4" /> New Routine
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {items.map((routine, index) => (
            <article
              key={routine.id}
              data-enter
              style={{ "--i": index } as never}
              className={cn(CARD, "p-4 @[48rem]:p-5")}
            >
              <header className="mb-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-bold text-foreground">
                    {routine.name}
                  </h3>
                  {routine.description ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {routine.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${routine.name}`}
                    onClick={() => openEdit(routine)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmDeleteButton
                    title="Delete routine?"
                    description={`"${routine.name}" will be removed.`}
                    label={`Delete ${routine.name}`}
                    onConfirm={() => deleteRoutine.mutate(routine.id)}
                    disabled={deleteRoutine.isPending}
                  />
                </div>
              </header>

              {/* The week reflows to the width of the pane rather than forcing
                  a 640px row that has to be scrolled sideways on a phone. */}
              <ul className="grid grid-cols-2 gap-2 @[26rem]:grid-cols-4 @[44rem]:grid-cols-7">
                {WEEKDAYS.map((day) => {
                  const ids = routine.workouts[day] ?? [];
                  return (
                    <li key={day} className="flex min-w-0 flex-col gap-1.5">
                      <p className="text-center text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        {day}
                      </p>
                      {ids.length === 0 ? (
                        <span className="py-2 text-center text-xs text-muted-foreground">
                          Rest
                        </span>
                      ) : (
                        ids.map((id, i) => {
                          const w = byId(id);
                          return (
                            <button
                              key={`${id}-${i}`}
                              type="button"
                              aria-label={
                                w
                                  ? `Start ${w.name} — ${DAY_NAMES[day]}`
                                  : `${id} — workout not found`
                              }
                              disabled={!w}
                              onClick={() => w && startSession(buildSession(w))}
                              className={cn(
                                CHIP,
                                "group justify-between disabled:opacity-60",
                                workoutColorClass(w?.color),
                              )}
                            >
                              <span className="truncate">{w?.name ?? id}</span>
                              <Play
                                aria-hidden
                                className="h-3 w-3 shrink-0 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                              />
                            </button>
                          );
                        })
                      )}
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      </AsyncBoundary>

      <RoutineEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        routine={editing}
      />
    </div>
  );
}
