import {
  Activity,
  CalendarDays,
  Dumbbell,
  History as HistoryIcon,
  LayoutDashboard,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

import "@exercise/styles/exercise.css";

const NAV: Array<{ id: ExerciseView; label: string; icon: LucideIcon }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "workouts", label: "Workouts", icon: Dumbbell },
  { id: "routines", label: "Routines", icon: CalendarDays },
  { id: "equipment", label: "Equipment", icon: Activity },
  { id: "history", label: "History", icon: HistoryIcon },
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
      <Button variant="outline" size="sm" onClick={() => sync.mutate("week")} disabled={sync.isPending}>
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
    <div className="exercise-app flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <nav className="flex flex-wrap items-center gap-1.5" aria-label="Exercise sections">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className="exercise-tab"
                data-active={active}
                aria-current={active ? "page" : undefined}
                onClick={() => setView(item.id)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="ml-auto">
          <StravaSyncButton />
        </div>
      </div>

      <div className="exercise-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl p-4 lg:p-6">
          <ActiveView view={view} />
        </div>
      </div>
    </div>
  );
}
