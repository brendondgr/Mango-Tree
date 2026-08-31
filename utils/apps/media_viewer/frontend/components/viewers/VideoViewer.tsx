import { VideoOff } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { artifactContentUrl } from "@/services/mediaViewerClient";
import type { ArtifactRecord } from "@/types/mediaViewer";

interface VideoViewerProps {
  artifact: ArtifactRecord;
}

export function VideoViewer({ artifact }: VideoViewerProps) {
  // A missing or undecodable file used to render as an empty black box, and a
  // slow one as the same box with nothing to say it was loading. Both now say
  // which they are, the way the image and PDF viewers do.
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
  }, [artifact.id]);

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden p-4",
        status === "error" ? "bg-surface-1" : "bg-black",
      )}
    >
      {status === "error" ? (
        <EmptyState
          icon={VideoOff}
          title="Couldn't play this video"
          description={`${artifact.filename} could not be decoded or is no longer available.`}
        />
      ) : (
        <>
          {status === "loading" && (
            <div
              className="absolute inset-4 flex items-center justify-center"
              aria-busy="true"
            >
              <span className="sr-only">Loading {artifact.filename}…</span>
              <Skeleton className="h-full w-full" />
            </div>
          )}
          <video
            src={artifactContentUrl(artifact.id)}
            controls
            preload="metadata"
            className={cn(
              "max-h-full max-w-full object-contain",
              status === "loading" && "invisible",
            )}
            aria-label={artifact.filename}
            onLoadedMetadata={() => setStatus("ready")}
            onError={() => setStatus("error")}
          >
            <track kind="captions" />
          </video>
        </>
      )}
    </div>
  );
}
