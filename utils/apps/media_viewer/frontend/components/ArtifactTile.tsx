import { FileText, Film, ImageIcon, Play, Plus, Trash2 } from "lucide-react";
import { useRef, useState, type CSSProperties, type RefObject } from "react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { useComposerArtifactStore } from "@/features/chat/stores/composerArtifactStore";
import { artifactThumbnailUrl } from "@/services/mediaViewerClient";
import { formatBytes } from "@/features/chat/utils/fileType";
import type { ArtifactKind, ArtifactRecord } from "@/types/mediaViewer";
import { cn } from "@/lib/utils";

import { ArtifactDeleteConfirm } from "@media-viewer/components/ArtifactDeleteConfirm";
import { useArtifactDeleteFlow } from "@media-viewer/hooks/useArtifacts";

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
  /** Position in the grid, for the staggered enter animation. */
  index?: number;
  /**
   * Element focus returns to when this tile is deleted. A successful delete
   * unmounts the whole tile, including the Trash button focus would otherwise
   * be restored to, so the survivor has to come from the grid above.
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function ArtifactTile({
  artifact,
  index = 0,
  returnFocusRef,
}: ArtifactTileProps) {
  const ephemeralTab = useWorkspaceStore((s) => s.ephemeralTab);
  const openArtifactTab = useWorkspaceStore((s) => s.openArtifactTab);
  const expandSidebar = useWorkspaceStore((s) => s.expandSidebar);
  const enqueueArtifact = useComposerArtifactStore((s) => s.enqueueArtifact);
  const {
    confirmDelete,
    requestDelete,
    cancelDelete,
    handleDelete,
    isPending,
    error: deleteError,
  } = useArtifactDeleteFlow(artifact.id);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  const selected = ephemeralTab?.artifactId === artifact.id;
  const showThumbnail =
    !thumbnailFailed &&
    (artifact.kind === "image" || artifact.kind === "video");

  return (
    <article
      data-enter
      // `as CSSProperties`, not `as never`: a custom property is not in the
      // CSSProperties index signature, but `never` is assignable to anything
      // and would swallow a real error in this literal too.
      style={{ "--i": index } as CSSProperties}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[var(--radius-sm)] border border-border bg-card shadow-xs transition-colors",
        selected && "border-primary ring-1 ring-primary/30",
      )}
    >
      {/*
        One activation target per tile. The thumbnail and the filename used to
        be two separate buttons running the same handler, which meant two tab
        stops and (for image/video tiles, whose img is alt="") one of them with
        no accessible name at all. A stretched ::after keeps the whole card
        clickable from a single control; the action buttons below are
        positioned, so they still take their own clicks.
      */}
      <button
        type="button"
        className="flex w-full flex-col text-left after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-label={`Open ${artifact.filename}`}
        onClick={() => openArtifactTab(artifact.id)}
      >
        <div className="relative h-16 w-full overflow-hidden bg-surface-2">
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
                    <Play className="ml-0.5 h-3 w-3" aria-hidden />
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 px-1 text-muted-foreground">
              {artifact.kind === "pdf" || artifact.kind === "text" ? (
                <FileText className="h-5 w-5" aria-hidden />
              ) : artifact.kind === "video" ? (
                <Film className="h-5 w-5" aria-hidden />
              ) : (
                <ImageIcon className="h-5 w-5" aria-hidden />
              )}
              <span className="rounded-[var(--radius-sm)] bg-background/80 px-1 py-0.5 text-[10px] font-semibold tracking-wide text-foreground">
                {extensionBadge(artifact.filename, artifact.kind)}
              </span>
            </div>
          )}
        </div>
      </button>

      <div className="flex items-end gap-1 p-2 pt-1">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-xs font-medium text-foreground">
            {artifact.filename}
          </p>
          <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
            <span className="rounded-[var(--radius-sm)] bg-surface-2 px-1 py-0.5 font-medium">
              {kindLabel(artifact.kind)}
            </span>
            <span>{formatBytes(artifact.size_bytes)}</span>
            <span>{formatCreatedAt(artifact.created_at)}</span>
          </div>
        </div>

        <div className="relative flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            aria-label={`Add ${artifact.filename} to chat context`}
            onClick={(event) => {
              event.stopPropagation();
              enqueueArtifact(artifact.id);
              expandSidebar();
            }}
          >
            <Plus />
          </Button>
          <Button
            ref={deleteButtonRef}
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive hover:[&_svg]:text-destructive"
            aria-label={`Delete ${artifact.filename}`}
            onClick={(event) => {
              event.stopPropagation();
              requestDelete();
            }}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <ArtifactDeleteConfirm
        open={confirmDelete}
        filename={artifact.filename}
        isPending={isPending}
        error={deleteError}
        triggerRef={deleteButtonRef}
        returnFocusRef={returnFocusRef}
        onCancel={cancelDelete}
        onConfirm={handleDelete}
      />
    </article>
  );
}
