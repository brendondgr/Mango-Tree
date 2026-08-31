import { Plus } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ArtifactKind, ArtifactRecord } from "@/types/mediaViewer";
import { cn } from "@/lib/utils";
import { truncateDisplayName } from "@media-viewer/utils/filterArtifacts";

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

interface ArtifactPickerListProps {
  artifacts: ArtifactRecord[];
  onAdd: (artifactId: string) => void;
  variant?: "full" | "compact";
  className?: string;
}

export function ArtifactPickerList({
  artifacts,
  onAdd,
  variant = "full",
  className,
}: ArtifactPickerListProps) {
  const compact = variant === "compact";

  if (artifacts.length === 0) {
    return (
      <EmptyState
        compact
        title="No matching artifacts"
        description={compact ? undefined : "Try a different search or file type."}
        className={className}
      />
    );
  }

  return (
    <ScrollArea className={cn(compact ? "max-h-48" : "max-h-none", className)}>
      <ul className={cn(compact ? "p-1" : "p-2")}>
        {artifacts.map((artifact) => (
          <li key={artifact.id}>
            {/*
              The row itself is the control. It used to be a hover-highlighted
              div whose only activation point was a 24px icon button — the
              hover state promised a target that was not there, and the button
              was below the touch minimum. One full-width button is the target
              the row already looked like.
            */}
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-[var(--radius-sm)] text-left transition-colors",
                "hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                compact ? "min-h-11 px-2 py-1.5 app:min-h-9" : "min-h-11 px-2 py-2 app:min-h-10",
              )}
              aria-label={`Add ${artifact.filename} to chat context`}
              title={artifact.filename}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onAdd(artifact.id);
              }}
            >
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block font-medium text-foreground",
                    compact ? "text-xs" : "truncate text-sm",
                  )}
                >
                  {compact
                    ? truncateDisplayName(artifact.filename)
                    : artifact.filename}
                </span>
                <span
                  className={cn(
                    "block text-muted-foreground",
                    compact ? "text-[10px]" : "text-xs",
                  )}
                >
                  {kindLabel(artifact.kind)}
                </span>
              </span>
              <Plus
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </button>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
