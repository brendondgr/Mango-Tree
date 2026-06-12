import type { ArtifactKind, ArtifactRecord } from "@/types/mediaViewer";

export type ArtifactTypeFilter = "all" | "documents" | "images" | "videos";

const DOCUMENT_KINDS = new Set<ArtifactKind>([
  "text",
  "pdf",
  "markdown",
  "latex",
]);

export interface FilterArtifactsOptions {
  query?: string;
  typeFilter?: ArtifactTypeFilter;
}

function matchesTypeFilter(kind: ArtifactKind, typeFilter: ArtifactTypeFilter): boolean {
  switch (typeFilter) {
    case "all":
      return true;
    case "documents":
      return DOCUMENT_KINDS.has(kind);
    case "images":
      return kind === "image";
    case "videos":
      return kind === "video";
    default:
      return true;
  }
}

export function filterArtifacts(
  artifacts: ArtifactRecord[],
  { query = "", typeFilter = "all" }: FilterArtifactsOptions = {},
): ArtifactRecord[] {
  const normalizedQuery = query.trim().toLowerCase();

  return artifacts.filter((artifact) => {
    if (!matchesTypeFilter(artifact.kind, typeFilter)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return artifact.filename.toLowerCase().includes(normalizedQuery);
  });
}

export function truncateDisplayName(name: string, maxLength = 35): string {
  if (name.length <= maxLength) return name;
  return `${name.slice(0, maxLength - 1)}…`;
}

function relevanceScore(filename: string, query: string): number {
  const lower = filename.toLowerCase();
  if (lower === query) return 1_000;
  if (lower.startsWith(query)) return 800 - Math.min(lower.length, 100);
  const index = lower.indexOf(query);
  if (index >= 0) return 500 - index;
  return -1;
}

export interface ArtifactsForPickerOptions extends FilterArtifactsOptions {
  limit?: number;
}

export function artifactsForPicker(
  artifacts: ArtifactRecord[],
  { query = "", typeFilter = "all", limit = 10 }: ArtifactsForPickerOptions = {},
): ArtifactRecord[] {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = filterArtifacts(artifacts, { query, typeFilter });

  if (!normalizedQuery) {
    return [...filtered]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }

  return [...filtered]
    .map((artifact) => ({
      artifact,
      score: relevanceScore(artifact.filename, normalizedQuery),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.artifact.created_at.localeCompare(a.artifact.created_at);
    })
    .slice(0, limit)
    .map((entry) => entry.artifact);
}
