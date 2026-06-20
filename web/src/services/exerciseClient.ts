// API client for the exercise app. Request/response only — no business logic.
// Endpoints documented in docs/api.md under "Exercise".

import type {
  ApiErrorBody,
  Equipment,
  HistoryLog,
  ListResponse,
  Routine,
  StravaSyncSummary,
  Workout,
} from "@/types/exercise";

const UNREACHABLE =
  "Cannot reach the exercise API. Start the backend with `uv run manage.py runserver`.";

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

const ALL = "?page_size=2000";

// --- workouts ---------------------------------------------------------------

export function listWorkouts(): Promise<ListResponse<Workout>> {
  return request<ListResponse<Workout>>(`/api/exercise/workouts/${ALL}`);
}

export function saveWorkout(workout: Workout): Promise<Workout> {
  return request<Workout>("/api/exercise/workouts/", {
    method: "POST",
    body: JSON.stringify(workout),
  });
}

export function deleteWorkout(id: string): Promise<void> {
  return request<void>(`/api/exercise/workouts/${encodeURIComponent(id)}/`, {
    method: "DELETE",
  });
}

// --- routines ---------------------------------------------------------------

export function listRoutines(): Promise<ListResponse<Routine>> {
  return request<ListResponse<Routine>>(`/api/exercise/routines/${ALL}`);
}

export function saveRoutine(routine: Routine): Promise<Routine> {
  return request<Routine>("/api/exercise/routines/", {
    method: "POST",
    body: JSON.stringify(routine),
  });
}

export function deleteRoutine(id: string): Promise<void> {
  return request<void>(`/api/exercise/routines/${encodeURIComponent(id)}/`, {
    method: "DELETE",
  });
}

// --- equipment --------------------------------------------------------------

export function listEquipment(): Promise<ListResponse<Equipment>> {
  return request<ListResponse<Equipment>>(`/api/exercise/equipment/${ALL}`);
}

export function addEquipment(equipment: Equipment): Promise<Equipment> {
  return request<Equipment>("/api/exercise/equipment/", {
    method: "POST",
    body: JSON.stringify(equipment),
  });
}

export function updateEquipment(id: string, equipment: Equipment): Promise<Equipment> {
  return request<Equipment>(`/api/exercise/equipment/${encodeURIComponent(id)}/`, {
    method: "PUT",
    body: JSON.stringify(equipment),
  });
}

export function deleteEquipment(id: string): Promise<void> {
  return request<void>(`/api/exercise/equipment/${encodeURIComponent(id)}/`, {
    method: "DELETE",
  });
}

// --- history ----------------------------------------------------------------

export function listHistory(): Promise<ListResponse<HistoryLog>> {
  return request<ListResponse<HistoryLog>>(`/api/exercise/history/${ALL}`);
}

export function addLog(log: HistoryLog): Promise<HistoryLog> {
  return request<HistoryLog>("/api/exercise/history/", {
    method: "POST",
    body: JSON.stringify(log),
  });
}

export function deleteLog(id: string): Promise<void> {
  return request<void>(`/api/exercise/history/${encodeURIComponent(id)}/`, {
    method: "DELETE",
  });
}

// --- strava -----------------------------------------------------------------

export function syncStrava(period: "week" | "all"): Promise<StravaSyncSummary> {
  return request<StravaSyncSummary>("/api/exercise/strava/sync/", {
    method: "POST",
    body: JSON.stringify({ period }),
  });
}
