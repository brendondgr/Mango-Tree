import { useState } from "react";
import { Check, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PROJECT_STATUSES } from "@/types/projectmanager";
import type { Project } from "@/types/projectmanager";
import { categoryClass, deadlineClass, progressBarClass } from "@projectmanager/utils/colors";
import {
  useProjectGoals,
  useToggleGoal,
  useDeleteGoal,
  useCreateGoals,
  useUpdateProjectStatus,
  useDeleteProject,
} from "@projectmanager/hooks/useProjectManager";

interface ProjectDetailDialogProps {
  project: Project | null;
  onOpenChange: (open: boolean) => void;
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

export function ProjectDetailDialog({
  project,
  onOpenChange,
}: ProjectDetailDialogProps) {
  const open = project !== null;

  const goals = useProjectGoals(project?.id ?? null);
  const toggleGoal = useToggleGoal(project?.id ?? 0);
  const deleteGoal = useDeleteGoal(project?.id ?? 0);
  const createGoals = useCreateGoals(project?.id ?? 0);
  const updateStatus = useUpdateProjectStatus();
  const deleteProject = useDeleteProject();

  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalDeadline, setNewGoalDeadline] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);

  if (!project) return null;

  const catClass = project.category
    ? categoryClass(project.category.color)
    : "projectmanager-cat-blue";
  const fillClass = project.category
    ? progressBarClass(project.category.color)
    : "projectmanager-progress-bar-blue";

  const goalList = goals.data ?? [];

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

  const handleDeleteProject = () => {
    deleteProject.mutate(project.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="projectmanager-app max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={catClass}>
              {project.category?.name ?? "Uncategorised"}
            </span>
            <DialogTitle className="text-xl font-bold">
              {project.title}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="projectmanager-scroll flex-1 overflow-y-auto space-y-5 pr-1">
          {/* Description */}
          {project.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {project.description}
            </p>
          )}

          {/* Meta */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {project.date_created && (
              <span>Added {fmt(project.date_created)}</span>
            )}
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
              <span className={deadlineClass(project.deadline_status.css_class)}>
                {project.deadline_status.display} ({project.deadline_status.date_formatted})
              </span>
            )}
          </div>

          {/* Status selector */}
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="projectmanager-tab text-sm py-1 px-3"
                  data-active={project.status === s}
                  onClick={() =>
                    updateStatus.mutate({ id: project.id, status: s })
                  }
                  disabled={updateStatus.isPending}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Goals section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Goals</h4>
              <span className="text-xs text-muted-foreground">
                {project.completed_goal_count}/{project.goal_count}
              </span>
            </div>

            {goals.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading goals…</p>
            ) : goalList.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No goals yet. Add one below.
              </p>
            ) : (
              <div className="space-y-1.5">
                {goalList.map((goal) => {
                  const done = goal.status === "Completed";
                  return (
                    <div key={goal.id} className="projectmanager-goal-item">
                      {/* Checkbox */}
                      <button
                        type="button"
                        className="projectmanager-goal-checkbox"
                        data-done={done}
                        aria-label={done ? "Mark incomplete" : "Mark complete"}
                        onClick={() => toggleGoal.mutate(goal.id)}
                        disabled={toggleGoal.isPending}
                      >
                        {done && <Check className="h-3 w-3" />}
                      </button>

                      {/* Title + meta */}
                      <div className="flex-1 min-w-0">
                        <span
                          className="projectmanager-goal-title"
                          data-done={done}
                        >
                          {goal.title}
                        </span>
                        <div className="flex flex-wrap gap-2 mt-0.5">
                          {goal.date_created && (
                            <span className="text-[0.6rem] text-muted-foreground">
                              Added {fmt(goal.date_created)}
                            </span>
                          )}
                          {done && goal.date_completed && (
                            <span className="text-[0.6rem] text-muted-foreground">
                              Done {fmt(goal.date_completed)}
                            </span>
                          )}
                          {goal.deadline_status && !done && (
                            <span
                              className={deadlineClass(
                                goal.deadline_status.css_class,
                              )}
                            >
                              {goal.deadline_status.display}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete goal */}
                      <button
                        type="button"
                        aria-label="Delete goal"
                        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                        style={{ opacity: 1 }}
                        onClick={() => deleteGoal.mutate(goal.id)}
                        disabled={deleteGoal.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add goal form */}
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="Add a new goal…"
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddGoal();
                }}
              />
              <Input
                type="date"
                className="w-36 shrink-0"
                value={newGoalDeadline}
                onChange={(e) => setNewGoalDeadline(e.target.value)}
                title="Deadline (optional)"
              />
              <Button
                size="sm"
                onClick={handleAddGoal}
                disabled={createGoals.isPending}
              >
                Add
              </Button>
            </div>
            {goalError && (
              <p className="text-xs text-destructive">{goalError}</p>
            )}
          </div>

          {/* Progress footer */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span className="font-semibold text-foreground">
                {project.progress}%
              </span>
            </div>
            <div className="projectmanager-progress">
              <div
                className={`projectmanager-progress-bar ${fillClass}`}
                style={{ width: `${project.progress}%` }}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          {confirmDelete ? (
            <>
              <span className="text-xs text-destructive flex items-center mr-auto">
                This cannot be undone.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteProject}
                disabled={deleteProject.isPending}
              >
                {deleteProject.isPending ? "Deleting…" : "Delete Project"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="mr-auto text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete Project
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
