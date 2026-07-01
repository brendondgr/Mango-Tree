// API client for the timekeeper app. Request/response only — no business logic.
// Endpoints documented in docs/api.md under "Time Keeper".

import type {
  ApiErrorBody,
  Category,
  DailyTotal,
  Interval,
  ListResponse,
  SaveDayResponse,
  TimeLog,
} from "@/types/timekeeper";

const UNREACHABLE =
  "Cannot reach the time keeper API. Start the backend with `uv run manage.py runserver`.";

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

const BASE = "/api/timekeeper";
const ALL = "?page_size=2000";

// --- logs -------------------------------------------------------------------

export function listLogs(date?: string): Promise<ListResponse<TimeLog>> {
  const q = date ? `?date=${encodeURIComponent(date)}&page_size=2000` : ALL;
  return request<ListResponse<TimeLog>>(`${BASE}/logs/${q}`);
}

export function saveDay(date: string, intervals: Interval[]): Promise<SaveDayResponse> {
  return request<SaveDayResponse>(`${BASE}/logs/`, {
    method: "POST",
    body: JSON.stringify({ date, intervals }),
  });
}

export function updateLog(
  id: number,
  patch: { start_time?: string; duration?: number; notes?: string | null },
): Promise<TimeLog> {
  return request<TimeLog>(`${BASE}/logs/${id}/`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteLog(id: number): Promise<void> {
  return request<void>(`${BASE}/logs/${id}/`, { method: "DELETE" });
}

// --- stats ------------------------------------------------------------------

export function dailyTotals(): Promise<{ days: DailyTotal[] }> {
  return request<{ days: DailyTotal[] }>(`${BASE}/stats/daily/`);
}

// --- categories -------------------------------------------------------------

export function getCategories(): Promise<{ categories: Category[] }> {
  return request<{ categories: Category[] }>(`${BASE}/categories/`);
}

export function saveCategories(categories: Category[]): Promise<{ categories: Category[] }> {
  return request<{ categories: Category[] }>(`${BASE}/categories/`, {
    method: "PUT",
    body: JSON.stringify({ categories }),
  });
}
