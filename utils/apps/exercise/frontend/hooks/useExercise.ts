import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/services/exerciseClient";
import type { Equipment, HistoryLog, Routine, Workout } from "@/types/exercise";

export const EXERCISE_KEYS = {
  workouts: ["exercise", "workouts"] as const,
  routines: ["exercise", "routines"] as const,
  equipment: ["exercise", "equipment"] as const,
  history: ["exercise", "history"] as const,
};

export function useWorkouts() {
  return useQuery({
    queryKey: EXERCISE_KEYS.workouts,
    queryFn: async () => (await api.listWorkouts()).results,
  });
}

export function useRoutines() {
  return useQuery({
    queryKey: EXERCISE_KEYS.routines,
    queryFn: async () => (await api.listRoutines()).results,
  });
}

export function useEquipment() {
  return useQuery({
    queryKey: EXERCISE_KEYS.equipment,
    queryFn: async () => (await api.listEquipment()).results,
  });
}

export function useHistory() {
  return useQuery({
    queryKey: EXERCISE_KEYS.history,
    queryFn: async () => (await api.listHistory()).results,
  });
}

export function useSaveWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workout: Workout) => api.saveWorkout(workout),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXERCISE_KEYS.workouts }),
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteWorkout(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXERCISE_KEYS.workouts }),
  });
}

export function useSaveRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (routine: Routine) => api.saveRoutine(routine),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXERCISE_KEYS.routines }),
  });
}

export function useDeleteRoutine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteRoutine(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXERCISE_KEYS.routines }),
  });
}

export function useAddEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (equipment: Equipment) => api.addEquipment(equipment),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXERCISE_KEYS.equipment }),
  });
}

export function useUpdateEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, equipment }: { id: string; equipment: Equipment }) =>
      api.updateEquipment(id, equipment),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXERCISE_KEYS.equipment }),
  });
}

export function useDeleteEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteEquipment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXERCISE_KEYS.equipment }),
  });
}

export function useAddLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (log: HistoryLog) => api.addLog(log),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXERCISE_KEYS.history }),
  });
}

export function useDeleteLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteLog(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXERCISE_KEYS.history }),
  });
}

export function useSyncStrava() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (period: "week" | "all") => api.syncStrava(period),
    onSuccess: () => qc.invalidateQueries({ queryKey: EXERCISE_KEYS.history }),
  });
}
