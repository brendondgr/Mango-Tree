import { useState } from "react";
import { Check, ChevronDown, Pencil, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PROJECT_STATUSES } from "@/types/projectmanager";
import type { Project } from "@/types/projectmanager";
import { categoryClass, deadlineClass, progressBarClass } from "@projectmanager/utils/colors";
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

export function ProjectDetailPanel({ project, onDeleted }: ProjectDetailPanelProps) {
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

  const catClass = project.category
    ? categoryClass(project.category.color)
    : "projectmanager-cat-blue";
  const fillClass = project.category
    ? progressBarClass(project.category.color)
    : "projectmanager-progress-bar-blue";
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
      { id: project.id, title: editTitle.trim(), description: editDesc.trim() || null },
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
    <div className="projectmanager-detail">
      {/* Header: badge + title (left), status dropdown + edit (top right) */}
      <div className="projectmanager-detail-header">
        <div className="min-w-0 flex-1 space-y-2">
          <span className={catClass}>
            {project.category?.name ?? "Uncategorised"}
          </span>
          {editing ? (
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-lg font-bold"
              aria-label="Project title"
              autoFocus
            />
          ) : (
            <h2 className="truncate text-xl font-bold text-foreground">
              {project.title}
            </h2>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Status changer — top-right dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={updateProject.isPending}
              >
                {project.status}
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {PROJECT_STATUSES.map((status) => (
                <DropdownMenuItem
                  key={status}
                  onSelect={() => changeStatus(status)}
                  className={status === project.status ? "bg-primary/5 text-primary" : ""}
                >
                  {status}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Edit title/description */}
          {editing ? (
            <>
              <Button
                size="sm"
                onClick={saveEdit}
                disabled={updateProject.isPending}
              >
                {updateProject.isPending ? "Saving…" : "Save"}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Cancel edit"
                onClick={() => setEditing(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Edit project"
              title="Edit title & description"
              onClick={startEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {editError && <p className="text-sm text-destructive">{editError}</p>}

      {/* Description */}
      {editing ? (
        <textarea
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          rows={3}
          placeholder="Description…"
          aria-label="Project description"
          className="projectmanager-input resize-none"
        />
      ) : (
        project.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {project.description}
          </p>
        )
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
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
          <span className={deadlineClass(project.deadline_status.css_class)}>
            {project.deadline_status.display} ({project.deadline_status.date_formatted})
          </span>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Goals */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Goals</h3>
          <span className="text-xs text-muted-foreground">
            {project.completed_goal_count}/{project.goal_count}
          </span>
        </div>

        {goals.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading goals…</p>
        ) : goalList.length === 0 ? (
          <p className="text-xs text-muted-foreground">No goals yet. Add one below.</p>
        ) : (
          <div className="space-y-1.5">
            {goalList.map((goal) => {
              const done = goal.status === "Completed";
              return (
                <div key={goal.id} className="projectmanager-goal-item">
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
                  <div className="min-w-0 flex-1">
                    <span className="projectmanager-goal-title" data-done={done}>
                      {goal.title}
                    </span>
                    <div className="mt-0.5 flex flex-wrap gap-2">
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
                        <span className={deadlineClass(goal.deadline_status.css_class)}>
                          {goal.deadline_status.display}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete goal"
                    className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
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

        {/* Add goal */}
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
          <Button size="sm" onClick={handleAddGoal} disabled={createGoals.isPending}>
            Add
          </Button>
        </div>
        {goalError && <p className="text-xs text-destructive">{goalError}</p>}
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span className="font-semibold text-foreground">{project.progress}%</span>
        </div>
        <div className="projectmanager-progress">
          <div
            className={`projectmanager-progress-bar ${fillClass}`}
            style={{ width: `${project.progress}%` }}
          />
        </div>
      </div>

      <div className="border-t border-border" />

      {/* Delete project */}
      <div className="flex flex-wrap items-center gap-2">
        {confirmDelete ? (
          <>
            <span className="mr-auto text-xs text-destructive">
              Delete this project and all its goals? This cannot be undone.
            </span>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteProject.isPending}
              onClick={() =>
                deleteProject.mutate(project.id, { onSuccess: onDeleted })
              }
            >
              {deleteProject.isPending ? "Deleting…" : "Delete Project"}
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete Project
          </Button>
        )}
      </div>
    </div>
  );
}
