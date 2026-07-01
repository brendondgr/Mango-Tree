// API client for the IMDbSpy app. Request/response only — no business logic.
// Endpoints documented in docs/api.md under "IMDbSpy".

import type {
  AddMediaResult,
  ApiErrorBody,
  ListParams,
  MediaItem,
  MediaListResult,
  MediaStatus,
  RatingWeights,
  RefreshResult,
  ReviewInput,
} from "@/types/imdbspy";

const BASE = "/api/imdbspy";
const UNREACHABLE =
  "Cannot reach the IMDbSpy API. Start the backend with `uv run manage.py runserver`.";

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

// --- media items ------------------------------------------------------------

export function listMedia(params: ListParams = {}): Promise<MediaListResult> {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.kind) qs.set("kind", params.kind);
  if (params.search) qs.set("search", params.search);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request<MediaListResult>(`${BASE}/media/${suffix}`);
}

export function addMedia(urls: string[]): Promise<AddMediaResult> {
  return request<AddMediaResult>(`${BASE}/media/add/`, {
    method: "POST",
    body: JSON.stringify({ urls }),
  });
}

export function refreshMetadata(): Promise<RefreshResult> {
  return request<RefreshResult>(`${BASE}/media/refresh/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function setStatus(id: number, status: MediaStatus): Promise<MediaItem> {
  return request<MediaItem>(`${BASE}/media/${id}/status/`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

export function updateReview(id: number, input: ReviewInput): Promise<MediaItem> {
  return request<MediaItem>(`${BASE}/media/${id}/review/`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function updateSeasons(id: number, seasonsSeen: number): Promise<MediaItem> {
  return request<MediaItem>(`${BASE}/media/${id}/seasons/`, {
    method: "PUT",
    body: JSON.stringify({ seasons_seen: seasonsSeen }),
  });
}

export function deleteMedia(id: number): Promise<void> {
  return request<void>(`${BASE}/media/${id}/`, { method: "DELETE" });
}

// --- rating weights (config surface) ----------------------------------------

export function getWeights(): Promise<RatingWeights[]> {
  return request<RatingWeights[]>(`${BASE}/weights/`);
}

export function updateWeights(
  weights: Array<Partial<RatingWeights> & { scale_type: string }>,
): Promise<RatingWeights[]> {
  return request<RatingWeights[]>(`${BASE}/weights/`, {
    method: "PUT",
    body: JSON.stringify(weights),
  });
}

// --- media assets -----------------------------------------------------------

/** Absolute URL for a cached poster/headshot given its stored relative path. */
export function assetUrl(relPath: string): string {
  return `${BASE}/assets/${relPath}`;
}
