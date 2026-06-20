import { RefreshCw } from "lucide-react";

import {
  type ExerciseView,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DashboardView } from "@exercise/components/DashboardView";
import { EquipmentView } from "@exercise/components/EquipmentView";
import { HistoryView } from "@exercise/components/HistoryView";
import { RoutinesView } from "@exercise/components/RoutinesView";
import { WorkoutsView } from "@exercise/components/WorkoutsView";
import { useSyncStrava } from "@exercise/hooks/useExercise";

const NAV: Array<{ id: ExerciseView; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "workouts", label: "Workouts" },
  { id: "routines", label: "Routines" },
  { id: "equipment", label: "Equipment" },
  { id: "history", label: "History" },
];

function StravaSyncButton() {
  const sync = useSyncStrava();
  const summary = sync.data;
  return (
    <div className="flex items-center gap-2">
      {sync.isError ? (
        <span className="text-xs text-destructive">{(sync.error as Error).message}</span>
      ) : summary ? (
        <span className="text-xs text-muted-foreground">
          +{summary.imported} imported · {summary.skipped} skipped
        </span>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={() => sync.mutate("week")}
        disabled={sync.isPending}
      >
        <RefreshCw className={cn("h-4 w-4", sync.isPending && "animate-spin")} />
        Sync Strava
      </Button>
    </div>
  );
}

function ActiveView({ view }: { view: ExerciseView }) {
  switch (view) {
    case "workouts":
      return <WorkoutsView />;
    case "routines":
      return <RoutinesView />;
    case "equipment":
      return <EquipmentView />;
    case "history":
      return <HistoryView />;
    default:
      return <DashboardView />;
  }
}

export function ExerciseWorkspace() {
  const view = useWorkspaceStore((s) => s.exerciseView);
  const setView = useWorkspaceStore((s) => s.setExerciseView);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border px-3 py-2">
        <nav className="flex items-center gap-1" aria-label="Exercise sections">
          {NAV.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant={view === item.id ? "secondary" : "ghost"}
              size="sm"
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </nav>
        <div className="ml-auto">
          <StravaSyncButton />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl p-4 lg:p-6">
          <ActiveView view={view} />
        </div>
      </div>
    </div>
  );
}
