import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import type { Project } from "@/types/projectmanager";
import { CategoryBadge } from "@projectmanager/components/CategoryBadge";
import { DeadlinePill } from "@projectmanager/components/DeadlinePill";
import { ProgressMeter } from "@projectmanager/components/ProgressMeter";

interface ProjectCardProps {
  project: Project;
  onClick: () => void;
  selected?: boolean;
  /** Position in the list, for the staggered enter. */
  index?: number;
}

/**
 * One project in the board list.
 *
 * The whole card is a real `<button>`, so Enter and Space work without a
 * hand-written key handler and the browser gives it a native focus ring; it was
 * previously an `<article role="button">` re-implementing both. The hover lift
 * is expressed in `--motion-travel-sm`, which is zero under reduced motion, so
 * there is no second rule to keep in sync.
 */
export function ProjectCard({
  project,
  onClick,
  selected = false,
  index = 0,
}: ProjectCardProps) {
  const categoryName = project.category?.name ?? "Uncategorised";

  return (
    <button
      type="button"
      data-enter
      style={{ "--i": index } as CSSProperties}
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group flex w-full flex-col gap-2.5 rounded-[var(--radius-md)] border p-3 text-left",
        "bg-card shadow-xs hover:shadow-md",
        "transition-[transform,box-shadow,border-color] duration-[var(--motion-duration-sm)] ease-[var(--motion-ease-standard)]",
        "hover:-translate-y-[var(--motion-travel-sm)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary ring-1 ring-primary"
          : "border-border hover:border-primary/40",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge name={categoryName} color={project.category?.color} />
        {project.deadline_status && project.status === "Active" && (
          <DeadlinePill status={project.deadline_status} />
        )}
      </div>

      <div className="min-w-0 space-y-1">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
          {project.title}
        </h3>
        {project.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {project.description}
          </p>
        )}
      </div>

      <ProgressMeter
        decorative
        value={project.progress}
        color={project.category?.color}
      />

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">{project.progress}% complete</span>
        <span className="tabular-nums">
          {project.completed_goal_count}/{project.goal_count} goal
          {project.goal_count === 1 ? "" : "s"}
        </span>
      </div>
    </button>
  );
}
