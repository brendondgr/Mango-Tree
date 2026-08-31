import { useMemo } from "react";
import { Dumbbell, History as HistoryIcon } from "lucide-react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { SkeletonList } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ConfirmDeleteButton } from "@exercise/components/ConfirmDeleteButton";
import { useDeleteLog, useHistory, useWorkouts } from "@exercise/hooks/useExercise";
import {
  formatDate,
  formatDuration,
  formatNumber,
  workoutColorClass,
} from "@exercise/utils/format";
import { CARD } from "@exercise/utils/ui";

export function HistoryView() {
  const history = useHistory();
  const workouts = useWorkouts();
  const deleteLog = useDeleteLog();
  const setView = useWorkspaceStore((s) => s.setExerciseView);

  const meta = (workoutId: string) => {
    if (workoutId === "run") return { label: "Run", colorClass: "exercise-c-run" };
    if (workoutId === "walk") return { label: "Walk", colorClass: "exercise-c-walk" };
    const w = workouts.data?.find((x) => x.id === workoutId);
    return { label: w?.name ?? "Workout", colorClass: workoutColorClass(w?.color) };
  };

  const sorted = useMemo(
    () =>
      [...(history.data ?? [])].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [history.data],
  );

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-foreground @[48rem]:text-2xl">
            History
          </h2>
          <p className="text-sm text-muted-foreground">
            {history.isLoading
              ? "Loading sessions…"
              : `${sorted.length} logged session${sorted.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </header>

      <AsyncBoundary
        loading={history.isLoading}
        error={history.error}
        empty={sorted.length === 0}
        onRetry={() => void history.refetch()}
        label="your history"
        skeleton={<SkeletonList count={6} className={cn(CARD, "px-4")} />}
        emptyIcon={HistoryIcon}
        emptyTitle="No sessions logged yet"
        emptyDescription="Finish a workout from the Workouts tab and it will show up here."
        emptyAction={
          // The other four views end their empty state with the action that
          // resolves it; history is only ever filled from the Workouts tab, so
          // the action is to go there.
          <Button variant="outline" onClick={() => setView("workouts")}>
            <Dumbbell className="h-4 w-4" /> Go to Workouts
          </Button>
        }
      >
        {/* The list grows with the page instead of being pinned to a
            viewport-derived height inside a resizable pane. */}
        <ul className={cn(CARD, "divide-y divide-border")}>
          {sorted.map((log, index) => {
            const m = meta(log.workout_id);
            return (
              <li
                key={log.id}
                data-enter
                style={{ "--i": index } as never}
                className={cn(
                  "flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5",
                  "transition-colors hover:bg-surface-1",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    aria-hidden
                    className={cn("exercise-dot shrink-0", m.colorClass)}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {m.label}
                      {log.notes ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {log.notes}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(log.date)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  <span className="tabular-nums text-muted-foreground">
                    {formatDuration(log.duration)}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatNumber(log.volume)}
                  </span>
                  <ConfirmDeleteButton
                    title="Delete session?"
                    description={`This ${m.label} session from ${formatDate(log.date)} will be removed.`}
                    label={`Delete ${m.label} session from ${formatDate(log.date)}`}
                    onConfirm={() => deleteLog.mutate(log.id)}
                    disabled={deleteLog.isPending}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </AsyncBoundary>
    </div>
  );
}
