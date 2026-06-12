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
      return "MD";
    case "latex":
      return "TEX";
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
  });
}

interface ArtifactTileProps {
  artifact: ArtifactRecord;
  onDelete: (artifact: ArtifactRecord) => void;
}

export function ArtifactTile({ artifact, onDelete }: ArtifactTileProps) {
  const ephemeralTab = useWorkspaceStore((s) => s.ephemeralTab);
  const openArtifactTab = useWorkspaceStore((s) => s.openArtifactTab);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  const selected = ephemeralTab?.artifactId === artifact.id;
  const showThumbnail =
    !thumbnailFailed &&
    (artifact.kind === "image" || artifact.kind === "video");

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[var(--radius-sm)] border border-border bg-card transition-colors",
        selected && "border-primary ring-1 ring-primary/30",
      )}
    >
      <button
        type="button"
        className="flex flex-1 flex-col text-left"
        onClick={() => openArtifactTab(artifact.id)}
      >
        <div className="relative h-16 w-full overflow-hidden bg-muted/40">
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
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm">
                    <Play className="ml-0.5 h-3 w-3" />
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-1 text-muted-foreground">
              {artifact.kind === "pdf" || artifact.kind === "text" ? (
                <FileText className="h-5 w-5" />
              ) : artifact.kind === "video" ? (
                <Film className="h-5 w-5" />
              ) : (
                <ImageIcon className="h-5 w-5" />
              )}
              <span className="rounded bg-background/80 px-1 py-0.5 text-[10px] font-semibold tracking-wide text-foreground">
                {extensionBadge(artifact.filename, artifact.kind)}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-0.5 p-2">
          <p className="truncate text-xs font-medium text-foreground">
            {artifact.filename}
          </p>
          <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
            <span className="rounded bg-muted px-1 py-0.5 font-medium">
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
        className="absolute right-1 top-1 h-6 w-6 bg-background/80 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={`Delete ${artifact.filename}`}
        onClick={() => onDelete(artifact)}
      >
        <Trash2 className="h-3 w-3 text-destructive" />
      </Button>
    </article>
  );
}
