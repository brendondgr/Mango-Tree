import { BarChart3, Clock, ListChecks, Tags } from "lucide-react";

import { type TimekeeperView, useWorkspaceStore } from "@/app/stores/workspaceStore";
import { AppHeader } from "@/components/app-shell/AppHeader";
import {
  SegmentedControl,
  type Segment,
} from "@/components/app-shell/SegmentedControl";

import { CategoriesView } from "@timekeeper/components/CategoriesView";
import { DashboardView } from "@timekeeper/components/DashboardView";
import { LogsView } from "@timekeeper/components/LogsView";
import { TrackerView } from "@timekeeper/components/TrackerView";

const NAV: Segment<TimekeeperView>[] = [
  { value: "tracker", label: "Tracker", icon: Clock },
  { value: "dashboard", label: "Dashboard", icon: BarChart3 },
  { value: "logs", label: "Logs", icon: ListChecks },
  { value: "categories", label: "Categories", icon: Tags },
];

const DESCRIPTION: Record<TimekeeperView, string> = {
  tracker: "Paint your day in five-minute blocks",
  dashboard: "Where the tracked hours went",
  logs: "Every interval you have saved",
  categories: "The colours you paint with",
};

function ActiveView({ view }: { view: TimekeeperView }) {
  switch (view) {
    case "dashboard":
      return <DashboardView />;
    case "logs":
      return <LogsView />;
    case "categories":
      return <CategoriesView />;
    default:
      return <TrackerView />;
  }
}

export function TimekeeperWorkspace() {
  const view = useWorkspaceStore((state) => state.timekeeperView);
  const setView = useWorkspaceStore((state) => state.setTimekeeperView);

  return (
    // `containerType` makes the pane itself the query container, so every
    // `@[…]` rule below reflows when the chat sidebar is dragged, not only when
    // the browser window changes size.
    <div
      className="flex min-h-0 flex-1 flex-col bg-background"
      style={{ containerType: "inline-size" }}
    >
      <AppHeader
        icon={Clock}
        title="Time Keeper"
        description={DESCRIPTION[view]}
        nav={
          <SegmentedControl
            segments={NAV}
            value={view}
            onValueChange={setView}
            label="Time Keeper sections"
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ActiveView view={view} />
      </div>
    </div>
  );
}
