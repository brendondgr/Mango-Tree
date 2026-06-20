import { useMemo } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDeleteButton } from "@exercise/components/ConfirmDeleteButton";
import {
  useDeleteLog,
  useHistory,
  useWorkouts,
} from "@exercise/hooks/useExercise";
import { formatDate, formatDuration, formatNumber } from "@exercise/utils/format";

export function HistoryView() {
  const history = useHistory();
  const workouts = useWorkouts();
  const deleteLog = useDeleteLog();

  const label = (workoutId: string) => {
    if (workoutId === "run") return "Run";
    if (workoutId === "walk") return "Walk";
    return workouts.data?.find((w) => w.id === workoutId)?.name ?? "Workout";
  };

  const sorted = useMemo(() => {
    return [...(history.data ?? [])].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [history.data]);

  if (history.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading history…</p>;
  }
  if (history.isError) {
    return <p className="text-sm text-destructive">{(history.error as Error).message}</p>;
  }
  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground">No sessions logged yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{sorted.length} sessions</p>
      <ScrollArea className="h-[60vh] rounded-[var(--radius-lg)] border border-border">
        <ul className="divide-y divide-border">
          {sorted.map((log) => (
            <li key={log.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {label(log.workout_id)}
                  {log.notes ? (
                    <span className="font-normal text-muted-foreground"> · {log.notes}</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(log.date)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                <span>{formatDuration(log.duration)}</span>
                <span>vol {formatNumber(log.volume)}</span>
                <ConfirmDeleteButton
                  title="Delete session?"
                  description="This logged session will be removed."
                  onConfirm={() => deleteLog.mutate(log.id)}
                  disabled={deleteLog.isPending}
                />
              </div>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
