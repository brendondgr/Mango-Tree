import { useState } from "react";
import { CalendarClock, GanttChartSquare, LayoutGrid, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  type ProjectManagerView,
  useWorkspaceStore,
} from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { BoardView } from "@projectmanager/components/BoardView";
import { DeadlinesView } from "@projectmanager/components/DeadlinesView";
import { NewProjectDialog } from "@projectmanager/components/NewProjectDialog";
import { TimelineView } from "@projectmanager/components/TimelineView";

import "@projectmanager/styles/projectmanager.css";

const NAV: Array<{ id: ProjectManagerView; label: string; icon: LucideIcon }> =
  [
    { id: "board", label: "Board", icon: LayoutGrid },
    { id: "timeline", label: "Timeline", icon: GanttChartSquare },
    { id: "deadlines", label: "Deadlines", icon: CalendarClock },
  ];

export function ProjectManagerWorkspace() {
  const view = useWorkspaceStore((s) => s.projectManagerView);
  const setView = useWorkspaceStore((s) => s.setProjectManagerView);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  return (
    <div className="projectmanager-app flex min-h-0 flex-1 flex-col bg-background">
      {/* Top navigation bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <nav
          className="flex flex-wrap items-center gap-1.5"
          aria-label="Project Manager sections"
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className="projectmanager-tab"
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
          <Button size="sm" onClick={() => setNewProjectOpen(true)}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      {/* Content. The board fills the viewport and scrolls internally; the
          other views scroll as a centred page. */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {view === "board" ? (
          <BoardView />
        ) : (
          <div className="projectmanager-scroll h-full overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl p-4 lg:p-6">
              {view === "timeline" ? <TimelineView /> : <DeadlinesView />}
            </div>
          </div>
        )}
      </div>

      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
    </div>
  );
}
