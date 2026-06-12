import {
  FileText,
  Film,
  ImageIcon,
  Play,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { artifactThumbnailUrl } from "@/services/mediaViewerClient";
import { formatBytes } from "@/features/chat/utils/fileType";
import type { ArtifactKind, ArtifactRecord } from "@/types/mediaViewer";
import { cn } from "@/lib/utils";

function kindLabel(kind: ArtifactKind): string {
  switch (kind) {
    case "image":
      return "Image";
    case "video":
      return "Video";
    case "pdf":
      return "PDF";
    case "markdown":
      return "Markdown";
    case "latex":
      return "LaTeX";
    case "text":
      return "Text";
    default:
      return "File";
  }
}

function extensionBadge(filename: string, kind: ArtifactKind): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot === -1 ? kind.toUpperCase() : filename.slice(dot + 1).toUpperCase();
  if (kind === "pdf") return "PDF";
  if (kind === "markdown") return "MD";
  if (kind === "latex") return "TEX";
  return ext.slice(0, 4);
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface ArtifactTileProps {
  artifact: ArtifactRecord;
  onDelete: (artifact: ArtifactRecord) => void;
}

export function ArtifactTile({ artifact, onDelete }: ArtifactTileProps) {
  const selectedArtifactId = useWorkspaceStore((s) => s.selectedArtifactId);
  const setSelectedArtifactId = useWorkspaceStore((s) => s.setSelectedArtifactId);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  const selected = selectedArtifactId === artifact.id;
  const showThumbnail =
    !thumbnailFailed &&
    (artifact.kind === "image" || artifact.kind === "video");

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[var(--radius-md)] border border-border bg-card transition-colors",
        selected && "border-primary ring-1 ring-primary/30",
      )}
    >
      <button
        type="button"
        className="flex flex-1 flex-col text-left"
        onClick={() => setSelectedArtifactId(artifact.id)}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/40">
          {showThumbnail ? (
            <>
              <img
                src={artifactThumbnailUrl(artifact.id)}
                alt=""
                className="h-full w-full object-cover"
                onError={() => setThumbnailFailed(true)}
              />
              {artifact.kind === "video" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm">
                    <Play className="ml-0.5 h-4 w-4" />
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-muted-foreground">
              {artifact.kind === "pdf" || artifact.kind === "text" ? (
                <FileText className="h-8 w-8" />
              ) : artifact.kind === "video" ? (
                <Film className="h-8 w-8" />
              ) : (
                <ImageIcon className="h-8 w-8" />
              )}
              <span className="rounded bg-background/80 px-2 py-0.5 text-xs font-semibold tracking-wide text-foreground">
                {extensionBadge(artifact.filename, artifact.kind)}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-1 p-3">
          <p className="truncate text-sm font-medium text-foreground">
            {artifact.filename}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5 font-medium">
              {kindLabel(artifact.kind)}
            </span>
            <span>{formatBytes(artifact.size_bytes)}</span>
            <span>{formatCreatedAt(artifact.created_at)}</span>
          </div>
        </div>
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8 bg-background/80 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={`Delete ${artifact.filename}`}
        onClick={() => onDelete(artifact)}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </article>
  );
}
