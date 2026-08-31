import {
  Activity,
  CalendarDays,
  Dumbbell,
  History as HistoryIcon,
  LayoutDashboard,
  RefreshCw,
} from "lucide-react";

import {
  type ExerciseView,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";
import { AppHeader } from "@/components/app-shell/AppHeader";
import {
  SegmentedControl,
  type Segment,
} from "@/components/app-shell/SegmentedControl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DashboardView } from "@exercise/components/DashboardView";
import { EquipmentView } from "@exercise/components/EquipmentView";
import { HistoryView } from "@exercise/components/HistoryView";
import { RoutinesView } from "@exercise/components/RoutinesView";
import { SessionView } from "@exercise/components/SessionView";
import { WorkoutsView } from "@exercise/components/WorkoutsView";
import { useSyncStrava } from "@exercise/hooks/useExercise";

import "@exercise/styles/exercise.css";

const SECTIONS: Segment<ExerciseView>[] = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "workouts", label: "Workouts", icon: Dumbbell },
  { value: "routines", label: "Routines", icon: CalendarDays },
  { value: "equipment", label: "Equipment", icon: Activity },
  { value: "history", label: "History", icon: HistoryIcon },
];

const SECTION_DESCRIPTION: Record<ExerciseView, string> = {
  dashboard: "Workouts, runs and walks at a glance",
  workouts: "Your custom workout programs",
  routines: "Weekly training schedules",
  equipment: "The gear you train with",
  history: "Every logged session",
};

function StravaSyncButton() {
  const sync = useSyncStrava();
  const summary = sync.data;
  return (
    <div className="flex items-center gap-2">
      {sync.isError ? (
        <span role="alert" className="text-xs text-destructive">
          {(sync.error as Error).message}
        </span>
      ) : summary ? (
        <span className="text-xs text-muted-foreground">
          +{summary.imported} imported · {summary.skipped} skipped
        </span>
      ) : null}
      <Button
        variant="outline"
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
  const session = useWorkspaceStore((s) => s.exerciseSession);

  // The module lives in a pane the user resizes by dragging the chat sidebar,
  // so every layout decision below reads the *container* width, not the
  // viewport. This is the query root for all of them.
  const containerStyle = { containerType: "inline-size" } as const;

  if (session) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col bg-background"
        style={containerStyle}
      >
        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col p-3 @[34rem]:p-4 @[60rem]:p-6">
          <SessionView />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-background"
      style={containerStyle}
    >
      <AppHeader
        icon={Dumbbell}
        title="Exercise"
        description={SECTION_DESCRIPTION[view]}
        nav={
          <SegmentedControl
            segments={SECTIONS}
            value={view}
            onValueChange={setView}
            label="Exercise sections"
          />
        }
        actions={<StravaSyncButton />}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl p-3 @[34rem]:p-4 @[60rem]:p-6">
          <ActiveView view={view} />
        </div>
      </div>
    </div>
  );
}
