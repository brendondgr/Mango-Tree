import { categoryClass, deadlineClass, progressBarClass } from "@projectmanager/utils/colors";
import type { Project } from "@/types/projectmanager";

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  selected?: boolean;
}

export function ProjectCard({ project, onClick, selected = false }: ProjectCardProps) {
  const catClass = project.category ? categoryClass(project.category.color) : "projectmanager-cat-blue";
  const fillClass = project.category ? progressBarClass(project.category.color) : "projectmanager-progress-bar-blue";

  return (
    <article
      className="projectmanager-card projectmanager-fade-in"
      data-selected={selected}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      aria-label={`Open ${project.title}`}
    >
      {/* Header: category badge + deadline pill */}
      <div className="projectmanager-card-header">
        {project.category ? (
          <span className={catClass}>{project.category.name}</span>
        ) : (
          <span className="projectmanager-cat-blue">Uncategorised</span>
        )}

        {project.deadline_status && project.status === "Active" && (
          <span className={deadlineClass(project.deadline_status.css_class)}>
            {project.deadline_status.display}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="projectmanager-card-title">{project.title}</h3>

      {/* Description (clamped to 2 lines) */}
      {project.description && (
        <p className="projectmanager-card-desc">{project.description}</p>
      )}

      {/* Progress bar */}
      <div className="projectmanager-progress" title={`${project.progress}% complete`}>
        <div
          className={`projectmanager-progress-bar ${fillClass}`}
          style={{ width: `${project.progress}%` }}
        />
      </div>

      {/* Footer: progress % and goal count */}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{project.progress}%</span>
        <span>
          {project.completed_goal_count}/{project.goal_count} goal
          {project.goal_count === 1 ? "" : "s"}
        </span>
      </div>
    </article>
  );
}
