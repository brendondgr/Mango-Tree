import { useCallback, useRef } from "react";

import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Skeleton } from "@/components/ui/skeleton";
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
  const { data: artifact, isLoading, error, refetch } = useArtifact(artifactId);

  const propertiesFraction = 1 - displayFraction;

  // The shared hook maps ArrowUp to a *larger* media fraction, which grows the
  // top row and pushes the separator down — the same direction as dragging
  // down, and the opposite of the number this separator reports, since
  // aria-valuenow is the properties share. The hook is shared with the other
  // split views, so the direction is corrected here by handing it the opposite
  // key: Up moves the separator up (properties grow), Down moves it down.
  const onSeparatorKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const flipped =
        event.key === "ArrowUp"
          ? "ArrowDown"
          : event.key === "ArrowDown"
            ? "ArrowUp"
            : null;
      if (flipped === null) {
        onHandleKeyDown(event);
        return;
      }
      event.preventDefault();
      onHandleKeyDown({
        ...event,
        key: flipped,
        preventDefault: () => event.preventDefault(),
      });
    },
    [onHandleKeyDown],
  );

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
          <AsyncBoundary
            className="flex min-h-0 flex-1 flex-col"
            label="this artifact"
            loading={isLoading}
            error={error}
            onRetry={() => void refetch()}
            skeleton={
              <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                <Skeleton className="min-h-0 w-full flex-1" />
                <Skeleton className="h-3.5 w-48 shrink-0" />
              </div>
            }
          >
            {artifact ? <ViewerBody artifact={artifact} /> : null}
          </AsyncBoundary>
        </div>

        {artifact && (
          <>
            <div
              role="separator"
              aria-label="Resize properties panel — drag, or use the arrow keys"
              aria-orientation="horizontal"
              // Bounds mirror clampViewerMediaFraction (0.2–0.8), and
              // aria-valuetext gives the announcement a unit, the way the
              // shell's sidebar separator does.
              aria-valuemin={20}
              aria-valuemax={80}
              aria-valuenow={Math.round(propertiesFraction * 100)}
              aria-valuetext={`Properties panel ${Math.round(
                propertiesFraction * 100,
              )}% of the viewer`}
              tabIndex={0}
              className={cn(
                "relative flex cursor-row-resize touch-none items-center justify-center border-y border-border bg-surface-2 transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                "z-[var(--z-header)]",
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
              onKeyDown={onSeparatorKeyDown}
            >
              <span className="h-px w-10 rounded-full bg-border" aria-hidden />
              {/* The grid row itself is 10px, which is under the 24px pointer
                  minimum, so the hit area is grown past the visible bar. */}
              <span
                className="absolute inset-x-0 -bottom-[7px] -top-[7px]"
                aria-hidden
              />
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
