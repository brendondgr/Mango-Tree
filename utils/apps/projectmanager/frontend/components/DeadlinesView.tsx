import { CalendarClock } from "lucide-react";
import { useMemo } from "react";

import { deadlineClass } from "@projectmanager/utils/colors";
import {
  useGoalsWithDeadlines,
  useProjects,
} from "@projectmanager/hooks/useProjectManager";
import type { Goal } from "@/types/projectmanager";

interface GoalRowProps {
  goal: Goal;
  projectTitle: string;
}

function GoalRow({ goal, projectTitle }: GoalRowProps) {
  const cls = deadlineClass(goal.deadline_status?.css_class ?? null);

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
      {/* Project name */}
      <div className="w-40 shrink-0 truncate text-xs font-semibold text-muted-foreground">
        {projectTitle}
      </div>

      {/* Goal title */}
      <div className="flex-1 min-w-0 truncate text-sm text-foreground">
        {goal.title}
      </div>

      {/* Deadline pill */}
      {goal.deadline_status && (
        <span className={cls}>
          {goal.deadline_status.date_short ?? goal.deadline_status.display}
        </span>
      )}
    </div>
  );
}

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

  if (goalsQuery.isLoading || projectsQuery.isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading deadlines…</p>
    );
  }

  if (goalsQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        {(goalsQuery.error as Error).message}
      </p>
    );
  }

  const goals = goalsQuery.data ?? [];

  if (goals.length === 0) {
    return (
      <div className="projectmanager-glass flex flex-col items-center gap-3 rounded-[var(--radius-lg)] p-10 text-center">
        <CalendarClock className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No goals with deadlines.
        </p>
      </div>
    );
  }

  const overdue = goals.filter((g) => g.deadline_status?.is_overdue);
  const upcoming = goals.filter((g) => !g.deadline_status?.is_overdue);

  return (
    <div className="projectmanager-fade-in flex flex-col gap-6">
      <header>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Deadlines
        </h2>
        <p className="text-sm text-muted-foreground">
          All goals with upcoming or overdue deadlines
        </p>
      </header>

      {overdue.length > 0 && (
        <section className="projectmanager-glass rounded-[var(--radius-lg)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <span className="projectmanager-deadline-overdue">
              Overdue
            </span>
            <span className="text-xs text-muted-foreground">
              {overdue.length} goal{overdue.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="px-4">
            {overdue.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                projectTitle={
                  projectMap.get(goal.project_id) ?? `Project #${goal.project_id}`
                }
              />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="projectmanager-glass rounded-[var(--radius-lg)] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <span className="projectmanager-deadline-warning">
              Upcoming
            </span>
            <span className="text-xs text-muted-foreground">
              {upcoming.length} goal{upcoming.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="px-4">
            {upcoming.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                projectTitle={
                  projectMap.get(goal.project_id) ?? `Project #${goal.project_id}`
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
