import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { artifactContentUrl } from "@/services/mediaViewerClient";
import type { ArtifactRecord } from "@/types/mediaViewer";

interface ImageViewerProps {
  artifact: ArtifactRecord;
  imageArtifacts: ArtifactRecord[];
}

export function ImageViewer({ artifact, imageArtifacts }: ImageViewerProps) {
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
  const active = sorted[activeIndex] ?? artifact;
  const hasMultiple = sorted.length > 1;

  useEffect(() => {
    setActiveIndex(
      Math.max(0, sorted.findIndex((item) => item.id === artifact.id)),
    );
  }, [artifact.id, sorted]);

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

  return (
    <div className="relative flex h-full min-h-0 flex-1 items-center justify-center bg-muted/20 p-4">
      {hasMultiple && (
        <>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2"
            aria-label="Previous image"
            onClick={() =>
              setActiveIndex((index) => (index > 0 ? index - 1 : sorted.length - 1))
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2"
            aria-label="Next image"
            onClick={() =>
              setActiveIndex((index) => (index < sorted.length - 1 ? index + 1 : 0))
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}

      <img
        src={artifactContentUrl(active.id)}
        alt={active.filename}
        className="max-h-full max-w-full object-contain"
      />

      {hasMultiple && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground">
          {activeIndex + 1} / {sorted.length}
        </p>
      )}
    </div>
  );
}
