import { ImageOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useContainedMediaSize } from "@/hooks/useContainedMediaSize";
import { cn } from "@/lib/utils";
import { artifactContentUrl } from "@/services/mediaViewerClient";
import type { ArtifactRecord } from "@/types/mediaViewer";

interface ImageViewerProps {
  artifact: ArtifactRecord;
}

export function ImageViewer({ artifact }: ImageViewerProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [loadedNatural, setLoadedNatural] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const naturalWidth = loadedNatural?.width ?? artifact.metadata.width ?? null;
  const naturalHeight = loadedNatural?.height ?? artifact.metadata.height ?? null;
  const fittedSize = useContainedMediaSize(canvasRef, naturalWidth, naturalHeight);

  useEffect(() => {
    setLoadedNatural(null);
    setLoaded(false);
    setFailed(false);
  }, [artifact.id]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-surface-1 p-4">
      <div
        ref={canvasRef}
        className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden"
      >
        {failed ? (
          // A broken <img> renders as a bare alt string with no explanation;
          // every other surface here names its failure, so this one does too.
          <EmptyState
            icon={ImageOff}
            title="Couldn't display this image"
            description={`${artifact.filename} could not be decoded or is no longer available.`}
          />
        ) : (
          <>
            {/* A large image over a slow link left this pane blank, with no
                sign anything was happening — every sibling viewer stands a
                skeleton in for its content while it loads. */}
            {!loaded && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                aria-busy="true"
              >
                <span className="sr-only">Loading {artifact.filename}…</span>
                <Skeleton
                  className="h-full w-full"
                  style={fittedSize ?? undefined}
                />
              </div>
            )}
            <img
              src={artifactContentUrl(artifact.id)}
              alt={artifact.filename}
              className={cn(
                "block max-h-full max-w-full object-contain",
                !loaded && "invisible",
              )}
              style={
                fittedSize
                  ? {
                      width: fittedSize.width,
                      height: fittedSize.height,
                    }
                  : undefined
              }
              onError={() => setFailed(true)}
              onLoad={(event) => {
                const img = event.currentTarget;
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  setLoadedNatural({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  });
                }
                setLoaded(true);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
