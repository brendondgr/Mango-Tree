import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useContainedMediaSize } from "@/hooks/useContainedMediaSize";
import { artifactContentUrl } from "@/services/mediaViewerClient";
import type { ArtifactRecord } from "@/types/mediaViewer";

interface ImageViewerProps {
  artifact: ArtifactRecord;
  imageArtifacts: ArtifactRecord[];
  onActiveArtifactChange?: (artifactId: string) => void;
}

export function ImageViewer({
  artifact,
  imageArtifacts,
  onActiveArtifactChange,
}: ImageViewerProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sorted = useMemo(
    () =>
      [...imageArtifacts].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      ),
    [imageArtifacts],
  );

  const initialIndex = Math.max(
    0,
    sorted.findIndex((item) => item.id === artifact.id),
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [loadedNatural, setLoadedNatural] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const active = sorted[activeIndex] ?? artifact;
  const hasMultiple = sorted.length > 1;

  const naturalWidth = loadedNatural?.width ?? active.metadata.width ?? null;
  const naturalHeight = loadedNatural?.height ?? active.metadata.height ?? null;
  const fittedSize = useContainedMediaSize(canvasRef, naturalWidth, naturalHeight);

  useEffect(() => {
    setActiveIndex(
      Math.max(0, sorted.findIndex((item) => item.id === artifact.id)),
    );
  }, [artifact.id, sorted]);

  useEffect(() => {
    setLoadedNatural(null);
  }, [active.id]);

  useEffect(() => {
    onActiveArtifactChange?.(active.id);
  }, [active.id, onActiveArtifactChange]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!hasMultiple) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((index) => (index > 0 ? index - 1 : sorted.length - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((index) => (index < sorted.length - 1 ? index + 1 : 0));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasMultiple, sorted.length]);

  const goPrevious = () =>
    setActiveIndex((index) => (index > 0 ? index - 1 : sorted.length - 1));

  const goNext = () =>
    setActiveIndex((index) => (index < sorted.length - 1 ? index + 1 : 0));

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-muted/20">
      <div className="flex min-h-0 min-w-0 flex-1 items-stretch gap-2 p-4">
        {hasMultiple && (
          <div className="flex shrink-0 items-center">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Previous image"
              onClick={goPrevious}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div
          ref={canvasRef}
          className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden"
        >
          <img
            src={artifactContentUrl(active.id)}
            alt={active.filename}
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

        {hasMultiple && (
          <div className="flex shrink-0 items-center">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Next image"
              onClick={goNext}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {hasMultiple && (
        <p className="shrink-0 pb-3 text-center text-xs text-muted-foreground">
          {activeIndex + 1} / {sorted.length}
        </p>
      )}
    </div>
  );
}
