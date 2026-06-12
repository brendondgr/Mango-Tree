import { useEffect, useRef, useState } from "react";

import { useContainedMediaSize } from "@/hooks/useContainedMediaSize";
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

  const naturalWidth = loadedNatural?.width ?? artifact.metadata.width ?? null;
  const naturalHeight = loadedNatural?.height ?? artifact.metadata.height ?? null;
  const fittedSize = useContainedMediaSize(canvasRef, naturalWidth, naturalHeight);

  useEffect(() => {
    setLoadedNatural(null);
  }, [artifact.id]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-muted/20 p-4">
      <div
        ref={canvasRef}
        className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden"
      >
        <img
          src={artifactContentUrl(artifact.id)}
          alt={artifact.filename}
          className="block max-h-full max-w-full object-contain"
          style={
            fittedSize
              ? {
                  width: fittedSize.width,
                  height: fittedSize.height,
                }
              : undefined
          }
          onLoad={(event) => {
            const img = event.currentTarget;
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              setLoadedNatural({
                width: img.naturalWidth,
                height: img.naturalHeight,
              });
            }
          }}
        />
      </div>
    </div>
  );
}
