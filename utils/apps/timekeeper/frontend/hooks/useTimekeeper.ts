import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/services/timekeeperClient";
import type { Category, Interval } from "@/types/timekeeper";

export const TIMEKEEPER_KEYS = {
  logs: ["timekeeper", "logs"] as const,
  logsByDate: (date: string) => ["timekeeper", "logs", date] as const,
  stats: ["timekeeper", "stats"] as const,
  categories: ["timekeeper", "categories"] as const,
};

// --- queries ----------------------------------------------------------------

export function useAllLogs() {
  return useQuery({
    queryKey: TIMEKEEPER_KEYS.logs,
    queryFn: async () => (await api.listLogs()).results,
  });
}

export function useDayLogs(date: string) {
  return useQuery({
    queryKey: TIMEKEEPER_KEYS.logsByDate(date),
    queryFn: async () => (await api.listLogs(date)).results,
    enabled: Boolean(date),
  });
}

export function useDailyTotals() {
  return useQuery({
    queryKey: TIMEKEEPER_KEYS.stats,
    queryFn: async () => (await api.dailyTotals()).days,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: TIMEKEEPER_KEYS.categories,
    queryFn: async () => (await api.getCategories()).categories,
  });
}

// --- mutations --------------------------------------------------------------

function useInvalidateLogs() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: TIMEKEEPER_KEYS.logs });
    qc.invalidateQueries({ queryKey: TIMEKEEPER_KEYS.stats });
  };
}

export function useSaveDay() {
  const invalidate = useInvalidateLogs();
  return useMutation({
    mutationFn: ({ date, intervals }: { date: string; intervals: Interval[] }) =>
      api.saveDay(date, intervals),
    onSuccess: invalidate,
  });
}

export function useDeleteLog() {
  const invalidate = useInvalidateLogs();
  return useMutation({
    mutationFn: (id: number) => api.deleteLog(id),
    onSuccess: invalidate,
  });
}

export function useSaveCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categories: Category[]) => api.saveCategories(categories),
    onSuccess: (data) => {
      qc.setQueryData(TIMEKEEPER_KEYS.categories, data.categories);
    },
  });
}
