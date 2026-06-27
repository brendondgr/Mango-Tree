// API client for the calendar app. Request/response only — no business logic.
// Endpoints documented in docs/api.md under "Calendar".

import type {
  ApiErrorBody,
  CalendarConfig,
  DayView,
  DirectEventInput,
  FreeSlotsResult,
  PaletteColor,
  PrintViewState,
  RangeView,
  Schedule,
  ScheduleDetail,
  ScheduleEvent,
  SchedulesList,
  UpcomingResult,
  WeekView,
} from "@/types/calendar";

const BASE = "/api/calendar";
const UNREACHABLE =
  "Cannot reach the calendar API. Start the backend with `uv run manage.py runserver`.";

async function parseError(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return {
      code: "internal_error",
      message: response.statusText || "Request failed",
      details: {},
    };
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      ...init,
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  if (!response.ok) {
    const error = await parseError(response);
    throw new Error(error.message || error.code);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

// --- schedules --------------------------------------------------------------

export function listSchedules(): Promise<SchedulesList> {
  return request<SchedulesList>(`${BASE}/schedules/`);
}

export function getScheduleDetail(filename: string): Promise<ScheduleDetail> {
  return request<ScheduleDetail>(`${BASE}/schedules/${encodeURIComponent(filename)}/`);
}

export function saveSchedule(
  schedule: Schedule & { filename?: string },
): Promise<{ message: string; filename: string }> {
  return request(`${BASE}/schedules/`, {
    method: "POST",
    body: JSON.stringify(schedule),
  });
}

export function deleteSchedule(
  filename: string,
): Promise<{ success: boolean; removed_mappings: number }> {
  return request(`${BASE}/schedules/${encodeURIComponent(filename)}/`, {
    method: "DELETE",
  });
}

export function updateColorMappings(
  filename: string,
  mappings: Record<string, string>,
): Promise<{ message: string }> {
  return request(`${BASE}/schedules/${encodeURIComponent(filename)}/color-mappings/`, {
    method: "PUT",
    body: JSON.stringify(mappings),
  });
}

export function renameCategory(
  filename: string,
  oldType: string,
  newType: string,
): Promise<{ message: string; updated: number }> {
  return request(`${BASE}/schedules/${encodeURIComponent(filename)}/categories/rename/`, {
    method: "POST",
    body: JSON.stringify({ old: oldType, new: newType }),
  });
}

export function addScheduleEvent(
  filename: string,
  event: ScheduleEvent,
): Promise<{ message: string; index: number }> {
  return request(`${BASE}/schedules/${encodeURIComponent(filename)}/events/`, {
    method: "POST",
    body: JSON.stringify(event),
  });
}

export function updateScheduleEvent(
  filename: string,
  index: number,
  event: ScheduleEvent,
): Promise<{ message: string }> {
  return request(`${BASE}/schedules/${encodeURIComponent(filename)}/events/${index}/`, {
    method: "PUT",
    body: JSON.stringify(event),
  });
}

export function deleteScheduleEvent(
  filename: string,
  index: number,
): Promise<{ message: string }> {
  return request(`${BASE}/schedules/${encodeURIComponent(filename)}/events/${index}/`, {
    method: "DELETE",
  });
}

/** Download a themed PDF of a schedule view; returns the PDF as a Blob. */
export async function printSchedule(
  filename: string,
  view: PrintViewState,
): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${BASE}/schedules/${encodeURIComponent(filename)}/print/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(view),
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  if (!response.ok) {
    const error = await parseError(response);
    throw new Error(error.message || error.code);
  }
  return response.blob();
}

// --- palette + instructions -------------------------------------------------

export function getColors(): Promise<PaletteColor[]> {
  return request<PaletteColor[]>(`${BASE}/colors/`);
}

export function getInstructions(): Promise<{ content: string }> {
  return request<{ content: string }>(`${BASE}/instructions/`);
}

// --- calendar config + merged views -----------------------------------------

export function getConfig(): Promise<CalendarConfig> {
  return request<CalendarConfig>(`${BASE}/config/`);
}

export function getDay(date: string): Promise<DayView> {
  return request<DayView>(`${BASE}/date/${date}/`);
}

export function getWeek(date?: string): Promise<WeekView> {
  const qs = date ? `?date=${date}` : "";
  return request<WeekView>(`${BASE}/week/${qs}`);
}

export function getRange(start: string, end: string): Promise<RangeView> {
  return request<RangeView>(`${BASE}/range/?start=${start}&end=${end}`);
}

// --- entries ----------------------------------------------------------------

export function addEntry(
  entry: { start_date: string; end_date: string; schedule_filename: string },
): Promise<{ message: string; index: number }> {
  return request(`${BASE}/entries/`, { method: "POST", body: JSON.stringify(entry) });
}

export function updateEntry(
  index: number,
  entry: { start_date: string; end_date: string; schedule_filename: string },
): Promise<{ message: string }> {
  return request(`${BASE}/entries/${index}/`, {
    method: "PUT",
    body: JSON.stringify(entry),
  });
}

export function deleteEntry(index: number): Promise<{ message: string }> {
  return request(`${BASE}/entries/${index}/`, { method: "DELETE" });
}

// --- direct events ----------------------------------------------------------

export function addDirectEvent(
  event: DirectEventInput,
): Promise<{ message: string; index: number }> {
  return request(`${BASE}/events/`, { method: "POST", body: JSON.stringify(event) });
}

export function updateDirectEvent(
  index: number,
  event: DirectEventInput,
): Promise<{ message: string }> {
  return request(`${BASE}/events/${index}/`, {
    method: "PUT",
    body: JSON.stringify(event),
  });
}

export function deleteDirectEvent(index: number): Promise<{ message: string }> {
  return request(`${BASE}/events/${index}/`, { method: "DELETE" });
}

export function deleteEventByTitle(
  date: string,
  title: string,
): Promise<{ success: boolean; index: number }> {
  return request(`${BASE}/events/delete-by-title/`, {
    method: "POST",
    body: JSON.stringify({ date, title }),
  });
}

// --- helpers ----------------------------------------------------------------

export function getFreeSlots(
  date: string,
  opts?: { minDuration?: number; startAfter?: string; endBefore?: string },
): Promise<FreeSlotsResult> {
  const params = new URLSearchParams({ date });
  if (opts?.minDuration != null) params.set("min_duration_minutes", String(opts.minDuration));
  if (opts?.startAfter) params.set("start_after", opts.startAfter);
  if (opts?.endBefore) params.set("end_before", opts.endBefore);
  return request<FreeSlotsResult>(`${BASE}/free-slots/?${params.toString()}`);
}

export function getUpcoming(
  daysAhead = 14,
  typeFilter?: string,
): Promise<UpcomingResult> {
  const params = new URLSearchParams({ days_ahead: String(daysAhead) });
  if (typeFilter) params.set("type_filter", typeFilter);
  return request<UpcomingResult>(`${BASE}/upcoming/?${params.toString()}`);
}
