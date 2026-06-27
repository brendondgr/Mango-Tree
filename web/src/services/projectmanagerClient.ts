// API client for the projectmanager app. Request/response only — no business
// logic. Endpoints documented in docs/api.md under "Project Manager".

import type {
  ApiErrorBody,
  Category,
  GanttData,
  Goal,
  ListResponse,
  NewGoal,
  NewProject,
  Project,
  TimelineFilters,
} from "@/types/projectmanager";

const UNREACHABLE =
  "Cannot reach the project manager API. Start the backend with `uv run manage.py runserver`.";

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

const BASE = "/api/projectmanager";
const ALL = "?page_size=2000";

// --- projects ---------------------------------------------------------------

export function listProjects(): Promise<ListResponse<Project>> {
  return request<ListResponse<Project>>(`${BASE}/projects/${ALL}`);
}

export function createProject(project: NewProject): Promise<Project> {
  return request<Project>(`${BASE}/projects/`, {
    method: "POST",
    body: JSON.stringify(project),
  });
}

export function getProject(id: number): Promise<Project> {
  return request<Project>(`${BASE}/projects/${id}/`);
}

export function updateProjectStatus(id: number, status: string): Promise<Project> {
  return request<Project>(`${BASE}/projects/${id}/`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteProject(id: number): Promise<void> {
  return request<void>(`${BASE}/projects/${id}/`, { method: "DELETE" });
}

// --- goals ------------------------------------------------------------------

export function listProjectGoals(projectId: number): Promise<ListResponse<Goal>> {
  return request<ListResponse<Goal>>(`${BASE}/projects/${projectId}/goals/${ALL}`);
}

export function createGoals(projectId: number, goals: NewGoal[]): Promise<{ goals: Goal[] }> {
  return request<{ goals: Goal[] }>(`${BASE}/projects/${projectId}/goals/`, {
    method: "POST",
    body: JSON.stringify({ goals }),
  });
}

export function listGoalsWithDeadlines(): Promise<ListResponse<Goal>> {
  return request<ListResponse<Goal>>(`${BASE}/goals/deadlines/${ALL}`);
}

export function toggleGoal(goalId: number): Promise<Goal> {
  return request<Goal>(`${BASE}/goals/${goalId}/toggle/`, { method: "POST" });
}

export function updateGoal(
  goalId: number,
  patch: { title?: string; deadline?: string | null },
): Promise<Goal> {
  return request<Goal>(`${BASE}/goals/${goalId}/`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteGoal(goalId: number): Promise<void> {
  return request<void>(`${BASE}/goals/${goalId}/`, { method: "DELETE" });
}

// --- categories -------------------------------------------------------------

export function listCategories(): Promise<ListResponse<Category>> {
  return request<ListResponse<Category>>(`${BASE}/categories/${ALL}`);
}

// --- timeline ---------------------------------------------------------------

function timelineQuery(filters?: TimelineFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.status?.length) params.set("status", filters.status.join(","));
  if (filters.type) params.set("type", filters.type);
  if (filters.start_date) params.set("start_date", filters.start_date);
  if (filters.end_date) params.set("end_date", filters.end_date);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function timelineDashboard(filters?: TimelineFilters): Promise<GanttData> {
  return request<GanttData>(`${BASE}/timeline/dashboard/${timelineQuery(filters)}`);
}

export function timelineProject(projectId: number, filters?: TimelineFilters): Promise<GanttData> {
  return request<GanttData>(
    `${BASE}/timeline/project/${projectId}/${timelineQuery(filters)}`,
  );
}
