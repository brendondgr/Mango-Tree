import { useState } from "react";
import {
  CalendarClock,
  FolderKanban,
  GanttChartSquare,
  LayoutGrid,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  type ProjectManagerView,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";
import { AppHeader } from "@/components/app-shell/AppHeader";
import { SegmentedControl } from "@/components/app-shell/SegmentedControl";
import { Button } from "@/components/ui/button";
import { BoardView } from "@projectmanager/components/BoardView";
import { DeadlinesView } from "@projectmanager/components/DeadlinesView";
import { NewProjectDialog } from "@projectmanager/components/NewProjectDialog";
import { TimelineView } from "@projectmanager/components/TimelineView";

const NAV: Array<{ value: ProjectManagerView; label: string; icon: LucideIcon }> =
  [
    { value: "board", label: "Board", icon: LayoutGrid },
    { value: "timeline", label: "Timeline", icon: GanttChartSquare },
    { value: "deadlines", label: "Deadlines", icon: CalendarClock },
  ];

/**
 * The Project Manager pane.
 *
 * `containerType: inline-size` here makes the pane itself the query container,
 * so every view below reflows against the width the user actually gave this
 * app by dragging the chat sidebar — not against the browser window, which is
 * what the old `max-width: 768px` media queries measured.
 */
export function ProjectManagerWorkspace() {
  const view = useWorkspaceStore((s) => s.projectManagerView);
  const setView = useWorkspaceStore((s) => s.setProjectManagerView);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-background"
      style={{ containerType: "inline-size" }}
    >
      <AppHeader
        icon={FolderKanban}
        title="Projects"
        description="Projects, goals and deadlines"
        nav={
          <SegmentedControl
            segments={NAV}
            value={view}
            onValueChange={setView}
            label="Project Manager sections"
            // See BoardView: lift the 36px segments to a 44px touch target on
            // compact only.
            className="max-app:[&_button]:h-11"
          />
        }
        actions={
          <Button onClick={() => setNewProjectOpen(true)}>
            <Plus />
            New project
          </Button>
        }
      />

      {/* The board fills the pane and scrolls internally; the other views
          scroll as a centred page. */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {view === "board" ? (
          <BoardView />
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="mx-auto w-full max-w-5xl p-4 @[48rem]:p-6">
              {view === "timeline" ? <TimelineView /> : <DeadlinesView />}
            </div>
          </div>
        )}
      </div>

      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
    </div>
  );
}
