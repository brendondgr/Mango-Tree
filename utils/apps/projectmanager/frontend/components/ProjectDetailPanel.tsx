import { useState } from "react";
import type { CSSProperties } from "react";
import { Check, ListTodo, Pencil, Plus, Trash2, X } from "lucide-react";

import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SkeletonList } from "@/components/ui/skeleton";
import { PROJECT_STATUSES } from "@/types/projectmanager";
import type { Project } from "@/types/projectmanager";
import { cn } from "@/lib/utils";
import { CategoryBadge } from "@projectmanager/components/CategoryBadge";
import { DeadlinePill } from "@projectmanager/components/DeadlinePill";
import { ProgressMeter } from "@projectmanager/components/ProgressMeter";
import { TEXTAREA_CLASS } from "@projectmanager/utils/classes";
import {
  useCreateGoals,
  useDeleteGoal,
  useDeleteProject,
  useProjectGoals,
  useToggleGoal,
  useUpdateProject,
} from "@projectmanager/hooks/useProjectManager";

interface ProjectDetailPanelProps {
  project: Project;
  onDeleted: () => void;
}

function fmt(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * The selected project: metadata, goals, progress, destructive actions.
 *
 * Every control here now has a real hit area. The goal toggle used to be a 20px
 * box and the goal delete a 22px icon — both under the 24px floor, and far
 * under 44px on touch. They are now `Button size="icon"` and a 44px→36px
 * button, with the visible mark drawn inside the target rather than being the
 * target.
 */
export function ProjectDetailPanel({
  project,
  onDeleted,
}: ProjectDetailPanelProps) {
  const goals = useProjectGoals(project.id);
  const toggleGoal = useToggleGoal(project.id);
  const deleteGoal = useDeleteGoal(project.id);
  const createGoals = useCreateGoals(project.id);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(project.title);
  const [editDesc, setEditDesc] = useState(project.description ?? "");
  const [editError, setEditError] = useState<string | null>(null);

  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalDeadline, setNewGoalDeadline] = useState("");
  const [goalError, setGoalError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const goalList = goals.data ?? [];

  const startEdit = () => {
    setEditTitle(project.title);
    setEditDesc(project.description ?? "");
    setEditError(null);
    setEditing(true);
  };

  const saveEdit = () => {
    if (!editTitle.trim()) {
      setEditError("Title is required.");
      return;
    }
    updateProject.mutate(
      {
        id: project.id,
        title: editTitle.trim(),
        description: editDesc.trim() || null,
      },
      {
        onSuccess: () => setEditing(false),
        onError: (err) => setEditError((err as Error).message),
      },
    );
  };

  const changeStatus = (status: string) => {
    if (status === project.status) return;
    updateProject.mutate({ id: project.id, status });
  };

  const handleAddGoal = () => {
    setGoalError(null);
    if (!newGoalTitle.trim()) {
      setGoalError("Goal title is required.");
      return;
    }
    createGoals.mutate(
      [{ title: newGoalTitle.trim(), deadline: newGoalDeadline || null }],
      {
        onSuccess: () => {
          setNewGoalTitle("");
          setNewGoalDeadline("");
        },
        onError: (err) => setGoalError((err as Error).message),
      },
    );
  };

  return (
    // A container of its own: the add-goal row and the page padding respond
    // to the width of THIS panel, not of the whole workspace pane.
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
      style={{ containerType: "inline-size" }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 @[45rem]:p-6">
        {/* Identity and the two things you do to a project as a whole. */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <CategoryBadge
              name={project.category?.name ?? "Uncategorised"}
              color={project.category?.color}
            />
            {editing ? (
              <Field label="Project title" hideLabel error={editError ?? undefined}>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-lg font-semibold"
                  autoFocus
                />
              </Field>
            ) : (
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {project.title}
              </h2>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Select
              value={project.status}
              onValueChange={changeStatus}
              disabled={updateProject.isPending}
            >
              <SelectTrigger
                className="w-[10.5rem]"
                aria-label="Project status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {editing ? (
              <>
                <Button onClick={saveEdit} disabled={updateProject.isPending}>
                  {updateProject.isPending ? "Saving…" : "Save"}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Cancel edit"
                  onClick={() => setEditing(false)}
                >
                  <X />
                </Button>
              </>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Edit title and description"
                onClick={startEdit}
              >
                <Pencil />
              </Button>
            )}
          </div>
        </div>

        {/* Description */}
        {editing ? (
          <Field label="Description" hideLabel>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              placeholder="Description…"
              className={TEXTAREA_CLASS}
            />
          </Field>
        ) : (
          project.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {project.description}
            </p>
          )
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          {project.date_created && <span>Added {fmt(project.date_created)}</span>}
          {project.status === "Completed" && project.date_completed && (
            <span>Completed {fmt(project.date_completed)}</span>
          )}
          {project.status === "On-Hold" && project.date_on_hold && (
            <span>On hold since {fmt(project.date_on_hold)}</span>
          )}
          {project.status === "Abandoned" && project.date_abandoned && (
            <span>Abandoned {fmt(project.date_abandoned)}</span>
          )}
          {project.deadline_status && (
            <DeadlinePill
              status={{
                ...project.deadline_status,
                display: `${project.deadline_status.display} (${project.deadline_status.date_formatted})`,
              }}
            />
          )}
        </div>

        {/* Progress */}
        <section className="space-y-1.5 rounded-[var(--radius-md)] border border-border bg-surface-1 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span className="font-semibold tabular-nums text-foreground">
              {project.progress}%
            </span>
          </div>
          <ProgressMeter
            value={project.progress}
            color={project.category?.color}
            label={`${project.title} progress`}
          />
        </section>

        {/* Goals */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Goals</h3>
            <span className="text-xs tabular-nums text-muted-foreground">
              {project.completed_goal_count}/{project.goal_count} complete
            </span>
          </div>

          <AsyncBoundary
            label="goals"
            loading={goals.isLoading}
            error={goals.error}
            empty={goalList.length === 0}
            onRetry={() => void goals.refetch()}
            skeleton={<SkeletonList count={3} />}
            emptyIcon={ListTodo}
            emptyTitle="No goals yet"
            emptyDescription="Add the first goal below to start tracking progress."
          >
            <ul className="flex flex-col gap-1.5">
              {goalList.map((goal, index) => {
                const done = goal.status === "Completed";
                return (
                  <li
                    key={goal.id}
                    data-enter
                    style={{ "--i": index } as CSSProperties}
                    className={cn(
                      "flex items-center gap-2 rounded-[var(--radius-md)] border border-transparent",
                      "bg-surface-2 px-2 py-1.5 transition-colors hover:border-border",
                    )}
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      role="checkbox"
                      aria-checked={done}
                      aria-label={`${goal.title}: ${done ? "mark incomplete" : "mark complete"}`}
                      onClick={() => toggleGoal.mutate(goal.id)}
                      disabled={toggleGoal.isPending}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-[var(--radius-sm)] border-2",
                          done
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-transparent",
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    </Button>

                    <div className="min-w-0 flex-1 py-0.5">
                      <p
                        className={cn(
                          "text-sm",
                          done
                            ? "text-muted-foreground line-through"
                            : "text-foreground",
                        )}
                      >
                        {goal.title}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[0.6875rem] text-muted-foreground">
                        {goal.date_created && (
                          <span>Added {fmt(goal.date_created)}</span>
                        )}
                        {done && goal.date_completed && (
                          <span>Done {fmt(goal.date_completed)}</span>
                        )}
                        {goal.deadline_status && !done && (
                          <DeadlinePill status={goal.deadline_status} />
                        )}
                      </div>
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete goal: ${goal.title}`}
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => deleteGoal.mutate(goal.id)}
                      disabled={deleteGoal.isPending}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </AsyncBoundary>

          {/* Add goal */}
          <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-surface-1 p-2 @[34rem]:flex-row @[34rem]:items-end">
            <Field
              label="New goal"
              hideLabel
              className="min-w-0 flex-1"
              error={goalError ?? undefined}
            >
              <Input
                placeholder="Add a new goal…"
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddGoal();
                }}
              />
            </Field>
            <div className="flex items-center gap-2">
              <Field label="Goal deadline" hideLabel className="min-w-0 flex-1">
                <Input
                  type="date"
                  className="@[34rem]:w-40"
                  value={newGoalDeadline}
                  onChange={(e) => setNewGoalDeadline(e.target.value)}
                />
              </Field>
              <Button
                onClick={handleAddGoal}
                disabled={createGoals.isPending}
                className="shrink-0"
              >
                <Plus />
                Add
              </Button>
            </div>
          </div>
        </section>

        {/* Destructive zone */}
        <section className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/5 p-3">
          {confirmDelete ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-xs font-medium text-destructive">
                Delete this project and all its goals? This cannot be undone.
              </p>
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deleteProject.isPending}
                onClick={() =>
                  deleteProject.mutate(project.id, { onSuccess: onDeleted })
                }
              >
                {deleteProject.isPending ? "Deleting…" : "Delete project"}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-xs text-muted-foreground">
                Deleting a project removes its goals too.
              </p>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 />
                Delete project
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
