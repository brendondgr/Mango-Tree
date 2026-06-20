import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Dumbbell, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardView } from "@exercise/components/DashboardView";
import { EquipmentView } from "@exercise/components/EquipmentView";
import { HistoryView } from "@exercise/components/HistoryView";
import { RoutinesView } from "@exercise/components/RoutinesView";
import { WorkoutsView } from "@exercise/components/WorkoutsView";
import { useSyncStrava } from "@exercise/hooks/useExercise";

const TABS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "workouts", label: "Workouts" },
  { value: "routines", label: "Routines" },
  { value: "equipment", label: "Equipment" },
  { value: "history", label: "History" },
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
          +{summary.imported} imported, {summary.skipped} skipped
        </span>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={() => sync.mutate("week")}
        disabled={sync.isPending}
      >
        <RefreshCw className={sync.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        Sync Strava
      </Button>
    </div>
  );
}

export function ExercisePage() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back to chat">
            <Link to="/chat">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Exercise</h1>
          </div>
        </div>
        <StravaSyncButton />
      </header>

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="shrink-0 border-b border-border px-4">
          {TABS.map((entry) => (
            <TabsTrigger key={entry.value} value={entry.value}>
              {entry.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl p-4 lg:p-6">
            <TabsContent value="dashboard">
              <DashboardView />
            </TabsContent>
            <TabsContent value="workouts">
              <WorkoutsView />
            </TabsContent>
            <TabsContent value="routines">
              <RoutinesView />
            </TabsContent>
            <TabsContent value="equipment">
              <EquipmentView />
            </TabsContent>
            <TabsContent value="history">
              <HistoryView />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
