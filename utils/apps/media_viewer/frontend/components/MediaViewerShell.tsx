import { Loader2, X } from "lucide-react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { MOBILE_BREAKPOINT, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

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
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const setSelectedArtifactId = useWorkspaceStore((s) => s.setSelectedArtifactId);
  const { data: artifact, isLoading, isError, error } = useArtifact(artifactId);
  const { data: listData } = useArtifacts();

  const imageArtifacts =
    listData?.results.filter((item) => item.kind === "image") ?? [];

  return (
    <section
      className="flex h-full min-h-0 flex-1 flex-col bg-background"
      aria-label="Artifact viewer"
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {artifact?.filename ?? "Loading artifact…"}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close viewer"
          onClick={() => setSelectedArtifactId(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col"
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
          <div
            className={cn(
              "min-h-[220px] shrink-0 lg:h-auto lg:w-[300px]",
              isMobile && "border-t border-border",
            )}
          >
            <ArtifactPropertiesPanel artifact={artifact} />
          </div>
        )}
      </div>
    </section>
  );
}
