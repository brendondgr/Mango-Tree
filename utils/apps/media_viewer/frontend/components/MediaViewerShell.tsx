import { useRef } from "react";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useViewerSplitResize } from "@/hooks/useViewerSplitResize";

import { ArtifactPropertiesPanel } from "@media-viewer/components/ArtifactPropertiesPanel";
import { useArtifact } from "@media-viewer/hooks/useArtifactViewer";
import { useArtifacts } from "@media-viewer/hooks/useArtifacts";
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
  imageArtifacts,
}: {
  artifact: NonNullable<ReturnType<typeof useArtifact>["data"]>;
  imageArtifacts: NonNullable<ReturnType<typeof useArtifacts>["data"]>["results"];
}) {
  switch (artifact.kind) {
    case "image":
      return <ImageViewer artifact={artifact} imageArtifacts={imageArtifacts} />;
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
  const { isResizing, displayFraction, beginResize } =
    useViewerSplitResize(splitContainerRef);
  const { data: artifact, isLoading, isError, error } = useArtifact(artifactId);
  const { data: listData } = useArtifacts();

  const imageArtifacts =
    listData?.results.filter((item) => item.kind === "image") ?? [];

  const mediaPercent = displayFraction * 100;
  const propertiesPercent = 100 - mediaPercent;

  return (
    <section
      className="flex h-full min-h-0 flex-1 flex-col bg-background"
      aria-label="Artifact viewer"
    >
      <div ref={splitContainerRef} className="flex min-h-0 flex-1 flex-col">
        <div
          className="flex min-h-0 flex-col overflow-hidden"
          style={{ flex: `${mediaPercent} 1 0%` }}
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
          {artifact && (
            <ViewerBody artifact={artifact} imageArtifacts={imageArtifacts} />
          )}
        </div>

        {artifact && (
          <>
            <div
              role="separator"
              aria-label="Resize viewer split"
              aria-orientation="horizontal"
              className={cn(
                "flex h-2 shrink-0 cursor-row-resize touch-none items-center justify-center border-y border-border bg-muted/30 transition-colors hover:bg-primary/5",
                isResizing && "bg-primary/10",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                beginResize(e.clientY);
              }}
            >
              <span className="h-0.5 w-8 rounded-full bg-border" />
            </div>

            <div
              className="min-h-0 overflow-hidden border-t border-border bg-card"
              style={{ flex: `${propertiesPercent} 1 0%` }}
            >
              <ArtifactPropertiesPanel artifact={artifact} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
