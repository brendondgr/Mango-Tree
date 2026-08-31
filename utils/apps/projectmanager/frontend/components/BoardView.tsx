import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  FolderKanban,
  PauseCircle,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { MasterDetail } from "@/components/app-shell/MasterDetail";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PROJECT_STATUSES } from "@/types/projectmanager";
import { ProjectCard } from "@projectmanager/components/ProjectCard";
import { ProjectDetailPanel } from "@projectmanager/components/ProjectDetailPanel";
import { useProjects } from "@projectmanager/hooks/useProjectManager";

type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// Each lifecycle status keeps its icon: Active = open circle, Completed =
// check, On-Hold = pause, Abandoned = cross.
const STATUS_ICON: Record<string, LucideIcon> = {
  Active: Circle,
  Completed: CheckCircle2,
  "On-Hold": PauseCircle,
  Abandoned: XCircle,
};

/**
 * The board's status filter.
 *
 * Deliberately not a `SegmentedControl`: that lays its segments out in one
 * non-wrapping row and hides whatever does not fit behind
 * `overflow-x-auto scrollbar-none`. Icon + full label + count is ~110px per
 * status, so ~450px of strip was being asked to fit the 21rem list column and
 * two of the four statuses sat off-screen with no scrollbar to reveal them —
 * the board's primary filter, half invisible in the default desktop layout.
 *
 * A reflowing grid instead: two columns in the list column, four across once
 * the list is the whole pane. Every status is visible at once, with its label
 * and its count, at any width. The container query measures the strip's own
 * column rather than the viewport, so it is right whatever the user does to
 * the chat sidebar.
 *
 * `role="group"` with `aria-pressed` toggles rather than `tablist` / `tab`,
 * because what follows is a filtered list, not a tabpanel — the same call
 * mailbox's density toggle makes.
 */
function StatusFilter({
  value,
  onChange,
  countOf,
}: {
  value: ProjectStatus;
  onChange: (status: ProjectStatus) => void;
  countOf: (status: ProjectStatus) => number;
}) {
  return (
    <div
      role="group"
      aria-label="Filter projects by status"
      className={cn(
        "grid grid-cols-2 gap-1 rounded-[var(--radius-md)] @[30rem]:grid-cols-4",
        "border border-border bg-surface-2 p-1",
      )}
    >
      {PROJECT_STATUSES.map((status) => {
        const Icon = STATUS_ICON[status] ?? Circle;
        const active = status === value;
        const count = countOf(status);
        return (
          <button
            key={status}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(status)}
            className={cn(
              // 44px touch target, stepped down to the 36px desktop density
              // above the shell breakpoint.
              "inline-flex h-11 items-center justify-center gap-1.5 app:h-9",
              "rounded-[var(--radius-sm)] px-2 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{status}</span>
            {count > 0 && (
              <span
                className={cn(
                  "shrink-0 rounded-full px-1.5 py-px text-[0.6875rem] font-semibold tabular-nums",
                  active
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function CardListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="space-y-2.5 rounded-[var(--radius-md)] border border-border bg-card p-3"
        >
          <Skeleton className="h-4 w-24 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-2 w-full rounded-[var(--radius-pill)]" />
        </div>
      ))}
    </div>
  );
}

/**
 * The board: a status-filtered project list beside the selected project.
 *
 * The two columns used to be a hard `flex` with a 320px fixed list, collapsing
 * only at a hardcoded 768px viewport media query — which is the wrong ruler for
 * a pane the user resizes by dragging the chat sidebar. `MasterDetail` measures
 * the pane itself and switches to push navigation, so a narrow pane behaves
 * like a phone regardless of how wide the window is.
 */
export function BoardView() {
  const projects = useProjects();
  const [statusFilter, setStatusFilter] = useState<ProjectStatus>("Active");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const all = projects.data ?? [];
  // Derive the selected project from the live list so edits/status changes
  // reflect immediately and a deleted project clears itself.
  const selected = all.find((p) => p.id === selectedId) ?? null;
  const cards = all.filter((p) => p.status === statusFilter);
  const countOf = (status: ProjectStatus) =>
    all.filter((p) => p.status === status).length;

  const list = (
    <>
      {/* Its own query container, so the filter below sizes itself against the
          list column rather than against the whole workspace pane. */}
      <div
        className="shrink-0 border-b border-border bg-card/60 p-2"
        style={{ containerType: "inline-size" }}
      >
        <StatusFilter
          value={statusFilter}
          onChange={setStatusFilter}
          countOf={countOf}
        />
      </div>

      <AsyncBoundary
        className="min-h-0 flex-1 overflow-y-auto"
        label="projects"
        loading={projects.isLoading}
        error={projects.error}
        empty={cards.length === 0}
        onRetry={() => void projects.refetch()}
        skeleton={<CardListSkeleton />}
        emptyIcon={STATUS_ICON[statusFilter] ?? Circle}
        emptyTitle={`No ${statusFilter.toLowerCase()} projects`}
        emptyDescription={
          all.length === 0
            ? "Create a project to start tracking its goals and deadlines."
            : "Switch to another status to see the rest of your projects."
        }
      >
        <ul className="flex flex-col gap-2 p-2">
          {cards.map((project, index) => (
            <li key={project.id}>
              <ProjectCard
                index={index}
                project={project}
                selected={project.id === selectedId}
                onClick={() => setSelectedId(project.id)}
              />
            </li>
          ))}
        </ul>
      </AsyncBoundary>
    </>
  );

  const detail = selected ? (
    <ProjectDetailPanel
      key={selected.id}
      project={selected}
      onDeleted={() => setSelectedId(null)}
    />
  ) : (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <EmptyState
        icon={FolderKanban}
        title="No project selected"
        description="Pick a project from the list to view, edit and manage its goals."
      />
    </div>
  );

  return (
    <MasterDetail
      className="h-full"
      list={list}
      detail={detail}
      selected={selected != null}
      onBack={() => setSelectedId(null)}
      detailTitle={selected?.title}
      listWidth="21rem"
    />
  );
}
