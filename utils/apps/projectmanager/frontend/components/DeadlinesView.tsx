import { AlertTriangle, CalendarClock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo } from "react";
import type { CSSProperties } from "react";

import { AsyncBoundary } from "@/components/ui/async-boundary";
import { SkeletonList } from "@/components/ui/skeleton";
import type { Goal } from "@/types/projectmanager";
import { DeadlinePill } from "@projectmanager/components/DeadlinePill";
import {
  useGoalsWithDeadlines,
  useProjects,
} from "@projectmanager/hooks/useProjectManager";

function GoalRow({
  goal,
  projectTitle,
  index,
}: {
  goal: Goal;
  projectTitle: string;
  index: number;
}) {
  return (
    <li
      data-enter
      style={{ "--i": index } as CSSProperties}
      className="flex flex-col gap-1 border-b border-border px-4 py-2.5 last:border-0 @[34rem]:flex-row @[34rem]:items-center @[34rem]:gap-3"
    >
      <span className="truncate text-xs font-semibold text-muted-foreground @[34rem]:w-40 @[34rem]:shrink-0">
        {projectTitle}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {goal.title}
      </span>
      {goal.deadline_status && (
        <DeadlinePill status={goal.deadline_status} short className="self-start" />
      )}
    </li>
  );
}

function DeadlineSection({
  title,
  icon: Icon,
  tone,
  goals,
  projectMap,
}: {
  title: string;
  icon: LucideIcon;
  tone: "overdue" | "upcoming";
  goals: Goal[];
  projectMap: Map<number, string>;
}) {
  if (goals.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-xs">
      <h3 className="flex items-center gap-2 border-b border-border bg-surface-1 px-4 py-2.5 text-sm font-semibold text-foreground">
        <Icon
          className={
            tone === "overdue"
              ? "h-4 w-4 shrink-0 text-destructive"
              : "h-4 w-4 shrink-0 text-muted-foreground"
          }
          aria-hidden
        />
        {title}
        <span className="text-xs font-normal tabular-nums text-muted-foreground">
          {goals.length} goal{goals.length === 1 ? "" : "s"}
        </span>
      </h3>
      <ul>
        {goals.map((goal, index) => (
          <GoalRow
            key={goal.id}
            goal={goal}
            index={index}
            projectTitle={
              projectMap.get(goal.project_id) ?? `Project #${goal.project_id}`
            }
          />
        ))}
      </ul>
    </section>
  );
}

/** Every goal that has a deadline, split into overdue and still upcoming. */
export function DeadlinesView() {
  const goalsQuery = useGoalsWithDeadlines();
  const projectsQuery = useProjects();

  const projectMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of projectsQuery.data ?? []) {
      m.set(p.id, p.title);
    }
    return m;
  }, [projectsQuery.data]);

  const goals = goalsQuery.data ?? [];
  const overdue = goals.filter((g) => g.deadline_status?.is_overdue);
  const upcoming = goals.filter((g) => !g.deadline_status?.is_overdue);

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-foreground @[45rem]:text-2xl">
          Deadlines
        </h2>
        <p className="text-sm text-muted-foreground">
          All goals with upcoming or overdue deadlines
        </p>
      </header>

      <AsyncBoundary
        label="deadlines"
        loading={goalsQuery.isLoading || projectsQuery.isLoading}
        error={goalsQuery.error ?? projectsQuery.error}
        empty={goals.length === 0}
        onRetry={() => {
          void goalsQuery.refetch();
          void projectsQuery.refetch();
        }}
        skeleton={
          <div className="rounded-[var(--radius-lg)] border border-border bg-card px-4 shadow-xs">
            <SkeletonList count={5} />
          </div>
        }
        emptyIcon={CalendarClock}
        emptyTitle="No goals with deadlines"
        emptyDescription="Give a goal a deadline and it will show up here, soonest first."
      >
        <div className="flex flex-col gap-4">
          <DeadlineSection
            title="Overdue"
            icon={AlertTriangle}
            tone="overdue"
            goals={overdue}
            projectMap={projectMap}
          />
          <DeadlineSection
            title="Upcoming"
            icon={CalendarClock}
            tone="upcoming"
            goals={upcoming}
            projectMap={projectMap}
          />
        </div>
      </AsyncBoundary>
    </section>
  );
}
