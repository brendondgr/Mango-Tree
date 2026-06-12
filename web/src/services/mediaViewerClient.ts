import type {
  ApiErrorBody,
  ArtifactListResponse,
  ArtifactRecord,
} from "@/types/mediaViewer";

async function parseError(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    if (response.status >= 500) {
      return {
        code: "internal_error",
        message:
          "Artifact API is unavailable. Start the backend with `uv run manage.py runserver` on port 8000.",
        details: {},
      };
    }
    return {
      code: "internal_error",
      message: response.statusText || "Request failed",
      details: {},
    };
  }
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new Error(
      "Cannot reach the artifact API. Start the backend with `uv run manage.py runserver` on port 8000.",
    );
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

export async function listArtifacts(params?: {
  page?: number;
  limit?: number;
  kind?: string;
}): Promise<ArtifactListResponse> {
  const search = new URLSearchParams();
  if (params?.page) search.set("page", String(params.page));
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.kind) search.set("kind", params.kind);
  const query = search.toString();
  return request<ArtifactListResponse>(
    `/api/media-viewer/artifacts/${query ? `?${query}` : ""}`,
  );
}

export async function getArtifact(id: string): Promise<ArtifactRecord> {
  return request<ArtifactRecord>(`/api/media-viewer/artifacts/${id}/`);
}

export async function uploadArtifact(
  file: File,
  fields?: {
    source?: string;
    source_chat_session_id?: string;
    source_message_id?: string;
    poster?: File;
  },
): Promise<ArtifactRecord> {
  const form = new FormData();
  form.append("file", file);
  if (fields?.source) form.append("source", fields.source);
  if (fields?.source_chat_session_id) {
    form.append("source_chat_session_id", fields.source_chat_session_id);
  }
  if (fields?.source_message_id) {
    form.append("source_message_id", fields.source_message_id);
  }
  if (fields?.poster) form.append("poster", fields.poster);
  return request<ArtifactRecord>("/api/media-viewer/artifacts/", {
    method: "POST",
    body: form,
  });
}

export async function deleteArtifact(id: string): Promise<void> {
  await request<void>(`/api/media-viewer/artifacts/${id}/`, {
    method: "DELETE",
  });
}

export function artifactContentUrl(id: string, disposition: "inline" | "attachment" = "inline") {
  return `/api/media-viewer/artifacts/${id}/content/?disposition=${disposition}`;
}

export function artifactThumbnailUrl(id: string) {
  return `/api/media-viewer/artifacts/${id}/thumbnail/`;
}
