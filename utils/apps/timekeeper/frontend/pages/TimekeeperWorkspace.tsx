import { BarChart3, Clock, ListChecks, Tags } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { type TimekeeperView, useWorkspaceStore } from "@/app/stores/workspaceStore";

import { CategoriesView } from "@timekeeper/components/CategoriesView";
import { DashboardView } from "@timekeeper/components/DashboardView";
import { LogsView } from "@timekeeper/components/LogsView";
import { TrackerView } from "@timekeeper/components/TrackerView";
import { useCategories } from "@timekeeper/hooks/useTimekeeper";

import "@timekeeper/styles/timekeeper.css";

const NAV: Array<{ id: TimekeeperView; label: string; icon: LucideIcon }> = [
  { id: "tracker", label: "Tracker", icon: Clock },
  { id: "dashboard", label: "Dashboard", icon: BarChart3 },
  { id: "logs", label: "Logs", icon: ListChecks },
  { id: "categories", label: "Categories", icon: Tags },
];

export function TimekeeperWorkspace() {
  const view = useWorkspaceStore((s) => s.timekeeperView);
  const setView = useWorkspaceStore((s) => s.setTimekeeperView);
  const { data: categories = [] } = useCategories();

  return (
    <div className="timekeeper-app flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-4 py-3">
        <nav className="flex flex-wrap items-center gap-1.5" aria-label="Time Keeper sections">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className="timekeeper-tab"
                data-active={view === item.id}
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => setView(item.id)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="timekeeper-scroll min-h-0 flex-1 overflow-y-auto">
        {view === "tracker" && <TrackerView categories={categories} />}
        {view === "dashboard" && <DashboardView categories={categories} />}
        {view === "logs" && <LogsView categories={categories} />}
        {view === "categories" && <CategoriesView categories={categories} />}
      </div>
    </div>
  );
}
