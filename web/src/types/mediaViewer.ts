export type ArtifactKind =
  | "image"
  | "video"
  | "pdf"
  | "markdown"
  | "latex"
  | "text"
  | "unknown";

export type ArtifactSource = "chat_upload" | "agent" | "manual";

export interface ArtifactMetadata {
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  page_count: number | null;
  language: string | null;
  checksum_sha256: string | null;
}

export interface ArtifactRecord {
  id: string;
  filename: string;
  mime_type: string;
  kind: ArtifactKind;
  size_bytes: number;
  created_at: string;
  source: ArtifactSource;
  source_chat_session_id: string | null;
  source_message_id: string | null;
  metadata: ArtifactMetadata;
}

export interface ArtifactListResponse {
  count: number;
  next: number | null;
  previous: number | null;
  results: ArtifactRecord[];
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
}
