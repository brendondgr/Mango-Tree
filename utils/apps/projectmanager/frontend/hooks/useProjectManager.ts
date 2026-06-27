import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/services/projectmanagerClient";
import type { NewGoal, NewProject, TimelineFilters } from "@/types/projectmanager";

export const PROJECTMANAGER_KEYS = {
  projects: ["projectmanager", "projects"] as const,
  categories: ["projectmanager", "categories"] as const,
  goalsWithDeadlines: ["projectmanager", "goals", "deadlines"] as const,
  timeline: ["projectmanager", "timeline"] as const,
  projectGoals: (id: number) => ["projectmanager", "project", id, "goals"] as const,
};

// --- queries ----------------------------------------------------------------

export function useProjects() {
  return useQuery({
    queryKey: PROJECTMANAGER_KEYS.projects,
    queryFn: async () => (await api.listProjects()).results,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: PROJECTMANAGER_KEYS.categories,
    queryFn: async () => (await api.listCategories()).results,
  });
}

export function useProjectGoals(projectId: number | null) {
  return useQuery({
    queryKey: projectId == null ? ["projectmanager", "project", "none"] : PROJECTMANAGER_KEYS.projectGoals(projectId),
    queryFn: async () => (await api.listProjectGoals(projectId as number)).results,
    enabled: projectId != null,
  });
}

export function useGoalsWithDeadlines() {
  return useQuery({
    queryKey: PROJECTMANAGER_KEYS.goalsWithDeadlines,
    queryFn: async () => (await api.listGoalsWithDeadlines()).results,
  });
}

export function useTimelineDashboard(filters?: TimelineFilters) {
  return useQuery({
    queryKey: [...PROJECTMANAGER_KEYS.timeline, filters ?? null],
    queryFn: () => api.timelineDashboard(filters),
  });
}

// --- mutations --------------------------------------------------------------

function useInvalidateBoard() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: PROJECTMANAGER_KEYS.projects });
    qc.invalidateQueries({ queryKey: PROJECTMANAGER_KEYS.goalsWithDeadlines });
    qc.invalidateQueries({ queryKey: PROJECTMANAGER_KEYS.timeline });
  };
}

export function useCreateProject() {
  const invalidate = useInvalidateBoard();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (project: NewProject) => api.createProject(project),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: PROJECTMANAGER_KEYS.categories });
    },
  });
}

export function useUpdateProjectStatus() {
  const invalidate = useInvalidateBoard();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.updateProjectStatus(id, status),
    onSuccess: invalidate,
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidateBoard();
  return useMutation({
    mutationFn: (id: number) => api.deleteProject(id),
    onSuccess: invalidate,
  });
}

export function useCreateGoals(projectId: number) {
  const invalidate = useInvalidateBoard();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goals: NewGoal[]) => api.createGoals(projectId, goals),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: PROJECTMANAGER_KEYS.projectGoals(projectId) });
    },
  });
}

export function useToggleGoal(projectId: number) {
  const invalidate = useInvalidateBoard();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goalId: number) => api.toggleGoal(goalId),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: PROJECTMANAGER_KEYS.projectGoals(projectId) });
    },
  });
}

export function useDeleteGoal(projectId: number) {
  const invalidate = useInvalidateBoard();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goalId: number) => api.deleteGoal(goalId),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: PROJECTMANAGER_KEYS.projectGoals(projectId) });
    },
  });
}
