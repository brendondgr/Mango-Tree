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
