import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  FolderKanban,
  PauseCircle,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PROJECT_STATUSES } from "@/types/projectmanager";
import { ProjectCard } from "@projectmanager/components/ProjectCard";
import { ProjectDetailPanel } from "@projectmanager/components/ProjectDetailPanel";
import { useProjects } from "@projectmanager/hooks/useProjectManager";

// Each lifecycle status is shown as an icon in the column tabs:
// Active = open circle, Completed = check, On-Hold = pause, Abandoned = cross.
const STATUS_ICON: Record<string, LucideIcon> = {
  Active: Circle,
  Completed: CheckCircle2,
  "On-Hold": PauseCircle,
  Abandoned: XCircle,
};

export function BoardView() {
  const projects = useProjects();
  const [statusTab, setStatusTab] = useState<string>("Active");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const all = projects.data ?? [];
  // Derive the selected project from the live list so edits/status changes
  // reflect immediately and a deleted project clears itself.
  const selected = all.find((p) => p.id === selectedId) ?? null;
  const cards = all.filter((p) => p.status === statusTab);
  const countOf = (status: string) =>
    all.filter((p) => p.status === status).length;

  return (
    <div className="projectmanager-master">
      {/* LEFT — a single column with one tab per status, scrolling internally */}
      <div className="projectmanager-list-pane">
        <div className="projectmanager-status-tabs" role="tablist">
          {PROJECT_STATUSES.map((status) => {
            const Icon = STATUS_ICON[status] ?? Circle;
            return (
              <button
                key={status}
                type="button"
                role="tab"
                className="projectmanager-status-tab"
                data-active={statusTab === status}
                aria-selected={statusTab === status}
                aria-label={status}
                title={status}
                onClick={() => setStatusTab(status)}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="projectmanager-status-tab-count">
                  {countOf(status)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="projectmanager-list-scroll projectmanager-scroll">
          {projects.isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Loading projects…</p>
          ) : projects.isError ? (
            <p className="p-3 text-sm text-destructive">
              {(projects.error as Error).message}
            </p>
          ) : cards.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              No {statusTab.toLowerCase()} projects.
            </p>
          ) : (
            cards.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                selected={project.id === selectedId}
                onClick={() => setSelectedId(project.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* RIGHT — the selected project loads inline here (no modal) */}
      <div className="projectmanager-detail-pane projectmanager-scroll">
        {selected ? (
          <ProjectDetailPanel
            key={selected.id}
            project={selected}
            onDeleted={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center text-muted-foreground">
            <FolderKanban className="h-10 w-10 opacity-40" />
            <p className="text-sm">
              Select a project from the left to view, edit, and manage its goals.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
