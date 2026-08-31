import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/services/calendarClient";
import type {
  DirectEventInput,
  Schedule,
  ScheduleEvent,
} from "@/types/calendar";

export const CALENDAR_KEYS = {
  palette: ["calendar", "palette"] as const,
  config: ["calendar", "config"] as const,
  schedules: ["calendar", "schedules"] as const,
  schedule: (file: string) => ["calendar", "schedule", file] as const,
  week: (date: string | undefined) => ["calendar", "week", date ?? "current"] as const,
  range: (start: string, end: string) => ["calendar", "range", start, end] as const,
  upcoming: (days: number) => ["calendar", "upcoming", days] as const,
};

// --- queries ----------------------------------------------------------------

export function usePalette() {
  return useQuery({
    queryKey: CALENDAR_KEYS.palette,
    queryFn: api.getColors,
    staleTime: Infinity,
  });
}

export function useConfig() {
  return useQuery({ queryKey: CALENDAR_KEYS.config, queryFn: api.getConfig });
}

export function useWeek(date: string | undefined) {
  return useQuery({
    queryKey: CALENDAR_KEYS.week(date),
    queryFn: () => api.getWeek(date),
  });
}

export function useRange(start: string, end: string, enabled = true) {
  return useQuery({
    queryKey: CALENDAR_KEYS.range(start, end),
    queryFn: () => api.getRange(start, end),
    enabled,
  });
}

export function useSchedules() {
  return useQuery({
    queryKey: CALENDAR_KEYS.schedules,
    queryFn: async () => (await api.listSchedules()).schedules,
  });
}

export function useScheduleDetail(file: string | null) {
  return useQuery({
    queryKey: file ? CALENDAR_KEYS.schedule(file) : ["calendar", "schedule", "none"],
    queryFn: () => api.getScheduleDetail(file as string),
    enabled: file != null,
  });
}

export function useUpcoming(daysAhead = 14) {
  return useQuery({
    queryKey: CALENDAR_KEYS.upcoming(daysAhead),
    queryFn: () => api.getUpcoming(daysAhead),
  });
}

// --- mutations --------------------------------------------------------------

function useInvalidateCalendar() {
  const qc = useQueryClient();
  return () => {
    // Invalidate the whole "calendar" namespace rather than naming each key.
    // The enumerated version silently missed ["calendar", "range"], which the
    // day/3-day timeline and the month grid both read: adding or deleting an
    // event left them showing stale data with no refetch, because the query
    // stays mounted so the staleTime-0 mount refetch never fires. Any future
    // query key is covered by construction.
    qc.invalidateQueries({ queryKey: ["calendar"] });
  };
}

export function useAddDirectEvent() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (event: DirectEventInput) => api.addDirectEvent(event),
    onSuccess: invalidate,
  });
}

export function useUpdateDirectEvent() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: ({ index, event }: { index: number; event: DirectEventInput }) =>
      api.updateDirectEvent(index, event),
    onSuccess: invalidate,
  });
}

export function useDeleteDirectEvent() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (index: number) => api.deleteDirectEvent(index),
    onSuccess: invalidate,
  });
}

export function useAddEntry() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (entry: {
      start_date: string;
      end_date: string;
      schedule_filename: string;
    }) => api.addEntry(entry),
    onSuccess: invalidate,
  });
}

export function useDeleteEntry() {
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (index: number) => api.deleteEntry(index),
    onSuccess: invalidate,
  });
}

// --- schedule editing -------------------------------------------------------

function useInvalidateSchedule(file: string) {
  const qc = useQueryClient();
  const invalidateCalendar = useInvalidateCalendar();
  return () => {
    qc.invalidateQueries({ queryKey: CALENDAR_KEYS.schedule(file) });
    qc.invalidateQueries({ queryKey: CALENDAR_KEYS.schedules });
    invalidateCalendar();
  };
}

export function useSaveSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (schedule: Schedule & { filename?: string }) =>
      api.saveSchedule(schedule),
    onSuccess: () => qc.invalidateQueries({ queryKey: CALENDAR_KEYS.schedules }),
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  const invalidate = useInvalidateCalendar();
  return useMutation({
    mutationFn: (file: string) => api.deleteSchedule(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CALENDAR_KEYS.schedules });
      invalidate();
    },
  });
}

export function useAddScheduleEvent(file: string) {
  const invalidate = useInvalidateSchedule(file);
  return useMutation({
    mutationFn: (event: ScheduleEvent) => api.addScheduleEvent(file, event),
    onSuccess: invalidate,
  });
}

export function useUpdateScheduleEvent(file: string) {
  const invalidate = useInvalidateSchedule(file);
  return useMutation({
    mutationFn: ({ index, event }: { index: number; event: ScheduleEvent }) =>
      api.updateScheduleEvent(file, index, event),
    onSuccess: invalidate,
  });
}

export function useDeleteScheduleEvent(file: string) {
  const invalidate = useInvalidateSchedule(file);
  return useMutation({
    mutationFn: (index: number) => api.deleteScheduleEvent(file, index),
    onSuccess: invalidate,
  });
}

export function useUpdateColorMappings(file: string) {
  const invalidate = useInvalidateSchedule(file);
  return useMutation({
    mutationFn: (mappings: Record<string, string>) =>
      api.updateColorMappings(file, mappings),
    onSuccess: invalidate,
  });
}

export function useRenameCategory(file: string) {
  const invalidate = useInvalidateSchedule(file);
  return useMutation({
    mutationFn: ({ oldType, newType }: { oldType: string; newType: string }) =>
      api.renameCategory(file, oldType, newType),
    onSuccess: invalidate,
  });
}
