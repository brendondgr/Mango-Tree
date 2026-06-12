import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      <p
        className={cn(
          "text-center text-muted-foreground",
          compact ? "px-2 py-4 text-xs" : "px-4 py-8 text-sm",
          className,
        )}
      >
        No matching artifacts
      </p>
    );
  }

  return (
    <ScrollArea
      className={cn(
        compact ? "max-h-48" : "max-h-none",
        className,
      )}
    >
      <ul className={cn(compact ? "p-1" : "p-2")}>
        {artifacts.map((artifact) => (
          <li key={artifact.id}>
            <div
              className={cn(
                "flex items-center gap-2 rounded-[var(--radius-sm)] hover:bg-muted/60",
                compact ? "px-1.5 py-1" : "px-2 py-1.5",
              )}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate font-medium text-foreground",
                    compact ? "text-xs" : "text-sm",
                  )}
                >
                  {artifact.filename}
                </p>
                <span
                  className={cn(
                    "text-muted-foreground",
                    compact ? "text-[10px]" : "text-xs",
                  )}
                >
                  {kindLabel(artifact.kind)}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn(
                  "shrink-0 text-muted-foreground hover:text-foreground",
                  compact ? "h-6 w-6" : "h-7 w-7",
                )}
                aria-label={`Add ${artifact.filename} to chat context`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onAdd(artifact.id);
                }}
              >
                <Plus className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
