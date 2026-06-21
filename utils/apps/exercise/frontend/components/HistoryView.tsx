import { useMemo } from "react";
import { History as HistoryIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { ConfirmDeleteButton } from "@exercise/components/ConfirmDeleteButton";
import {
  useDeleteLog,
  useHistory,
  useWorkouts,
} from "@exercise/hooks/useExercise";
import { formatDate, formatDuration, formatNumber, workoutColorClass } from "@exercise/utils/format";

export function HistoryView() {
  const history = useHistory();
  const workouts = useWorkouts();
  const deleteLog = useDeleteLog();

  const meta = (workoutId: string) => {
    if (workoutId === "run") return { label: "Run", colorClass: "exercise-c-run" };
    if (workoutId === "walk") return { label: "Walk", colorClass: "exercise-c-walk" };
    const w = workouts.data?.find((x) => x.id === workoutId);
    return { label: w?.name ?? "Workout", colorClass: workoutColorClass(w?.color) };
  };

  const sorted = useMemo(
    () => [...(history.data ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [history.data],
  );

  if (history.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading history…</p>;
  }
  if (history.isError) {
    return <p className="text-sm text-destructive">{(history.error as Error).message}</p>;
  }

  return (
    <div className="exercise-fade-in flex flex-col gap-4">
      <header className="flex items-end justify-between">
        <div>
          <h2 className="exercise-gradient-text text-2xl font-bold tracking-tight">History</h2>
          <p className="text-sm text-muted-foreground">{sorted.length} logged sessions</p>
        </div>
      </header>

      {sorted.length === 0 ? (
        <div className="exercise-glass flex flex-col items-center gap-2 rounded-[var(--radius-lg)] p-10 text-center">
          <HistoryIcon className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No sessions logged yet.</p>
        </div>
      ) : (
        <ul className="exercise-glass exercise-scroll max-h-[calc(100vh-16rem)] divide-y divide-border overflow-y-auto rounded-[var(--radius-lg)]">
          {sorted.map((log) => {
            const m = meta(log.workout_id);
            return (
              <li key={log.id} className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[color-mix(in_srgb,hsl(var(--foreground))_4%,transparent)]">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn("exercise-dot shrink-0", m.colorClass)} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {m.label}
                      {log.notes ? <span className="font-normal text-muted-foreground"> · {log.notes}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(log.date)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs">
                  <span className="text-muted-foreground">{formatDuration(log.duration)}</span>
                  <span className="font-medium text-foreground">{formatNumber(log.volume)}</span>
                  <ConfirmDeleteButton
                    title="Delete session?"
                    description="This logged session will be removed."
                    onConfirm={() => deleteLog.mutate(log.id)}
                    disabled={deleteLog.isPending}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
