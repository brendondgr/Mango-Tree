import { useState } from "react";
import { LayoutGrid } from "lucide-react";

import { PROJECT_STATUSES } from "@/types/projectmanager";
import type { Project } from "@/types/projectmanager";
import { ProjectCard } from "@projectmanager/components/ProjectCard";
import { ProjectDetailDialog } from "@projectmanager/components/ProjectDetailDialog";
import { useProjects } from "@projectmanager/hooks/useProjectManager";

export function BoardView() {
  const projects = useProjects();
  const [selected, setSelected] = useState<Project | null>(null);

  const all = projects.data ?? [];

  if (projects.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading projects…</p>
    );
  }

  if (projects.isError) {
    return (
      <p className="text-sm text-destructive">
        {(projects.error as Error).message}
      </p>
    );
  }

  return (
    <div className="projectmanager-fade-in flex flex-col gap-4">
      {all.length === 0 && (
        <div className="projectmanager-glass flex flex-col items-center gap-3 rounded-[var(--radius-lg)] p-10 text-center">
          <LayoutGrid className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No projects yet. Create your first project above.
          </p>
        </div>
      )}

      {all.length > 0 && (
        <div className="projectmanager-board">
          {PROJECT_STATUSES.map((status) => {
            const cards = all.filter((p) => p.status === status);
            return (
              <div key={status} className="projectmanager-column">
                <div className="projectmanager-column-header">
                  <span className="projectmanager-column-title">{status}</span>
                  <span className="projectmanager-column-count">
                    {cards.length}
                  </span>
                </div>
                <div className="projectmanager-column-body">
                  {cards.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">
                      Nothing here
                    </p>
                  ) : (
                    cards.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        onClick={() => setSelected(project)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProjectDetailDialog
        project={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
