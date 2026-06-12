import { useRef } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useViewerSplitResize } from "@/hooks/useViewerSplitResize";

import { ArtifactPropertiesPanel } from "@media-viewer/components/ArtifactPropertiesPanel";
import { useArtifact } from "@media-viewer/hooks/useArtifactViewer";
import { ImageViewer } from "@media-viewer/components/viewers/ImageViewer";
import { LatexViewer } from "@media-viewer/components/viewers/LatexViewer";
import { MarkdownViewer } from "@media-viewer/components/viewers/MarkdownViewer";
import { PdfViewer } from "@media-viewer/components/viewers/PdfViewer";
import { TextViewer } from "@media-viewer/components/viewers/TextViewer";
import { VideoViewer } from "@media-viewer/components/viewers/VideoViewer";

interface MediaViewerShellProps {
  artifactId: string;
}

function ViewerBody({
  artifact,
}: {
  artifact: NonNullable<ReturnType<typeof useArtifact>["data"]>;
}) {
  switch (artifact.kind) {
    case "image":
      return <ImageViewer artifact={artifact} />;
    case "video":
      return <VideoViewer artifact={artifact} />;
    case "pdf":
      return <PdfViewer artifact={artifact} />;
    case "markdown":
      return <MarkdownViewer artifact={artifact} />;
    case "latex":
      return <LatexViewer artifact={artifact} />;
    case "text":
    case "unknown":
    default:
      return <TextViewer artifact={artifact} />;
  }
}

export function MediaViewerShell({ artifactId }: MediaViewerShellProps) {
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const {
    isResizing,
    displayFraction,
    handleRowPx,
    onHandlePointerDown,
    onHandleKeyDown,
  } = useViewerSplitResize(splitContainerRef);
  const { data: artifact, isLoading, isError, error } = useArtifact(artifactId);

  const propertiesFraction = 1 - displayFraction;

  return (
    <section
      className="flex h-full min-h-0 flex-1 flex-col bg-background"
      aria-label="Artifact viewer"
    >
      <div
        ref={splitContainerRef}
        className={cn(
          "grid min-h-0 flex-1",
          !isResizing && "transition-[grid-template-rows] duration-150 ease-out",
        )}
        style={{
          gridTemplateRows: artifact
            ? `${displayFraction}fr ${handleRowPx}px ${propertiesFraction}fr`
            : "1fr",
        }}
      >
        <div
          className="flex min-h-0 min-w-0 flex-col overflow-hidden"
          tabIndex={-1}
          role="region"
          aria-label="Media canvas"
        >
          {isLoading && (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {isError && (
            <div className="p-6 text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load artifact"}
            </div>
          )}
          {artifact && <ViewerBody artifact={artifact} />}
        </div>

        {artifact && (
          <>
            <div
              role="separator"
              aria-label="Resize properties panel — drag up or down"
              aria-orientation="horizontal"
              aria-valuemin={20}
              aria-valuemax={80}
              aria-valuenow={Math.round(propertiesFraction * 100)}
              tabIndex={0}
              className={cn(
                "relative z-10 flex cursor-row-resize touch-none items-center justify-center border-y border-border bg-muted/40 transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isResizing && "bg-primary/10",
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onHandlePointerDown(event.clientY);
              }}
              onTouchStart={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (event.touches[0]) {
                  onHandlePointerDown(event.touches[0].clientY);
                }
              }}
              onKeyDown={onHandleKeyDown}
            >
              <span className="h-px w-10 rounded-full bg-border" />
              <span className="absolute inset-x-0 -top-1 -bottom-1" aria-hidden />
            </div>

            <div className="flex min-h-0 min-w-0 flex-col overflow-hidden border-t border-border bg-card">
              <ArtifactPropertiesPanel artifact={artifact} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
