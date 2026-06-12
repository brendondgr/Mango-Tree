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

  const goPrevious = () =>
    setActiveIndex((index) => (index > 0 ? index - 1 : sorted.length - 1));

  const goNext = () =>
    setActiveIndex((index) => (index < sorted.length - 1 ? index + 1 : 0));

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-muted/20">
      <div className="flex min-h-0 flex-1 items-center justify-center gap-2 p-4">
        {hasMultiple && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="shrink-0"
            aria-label="Previous image"
            onClick={goPrevious}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden">
          <img
            src={artifactContentUrl(active.id)}
            alt={active.filename}
            className="max-h-full max-w-full object-contain"
          />
        </div>

        {hasMultiple && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="shrink-0"
            aria-label="Next image"
            onClick={goNext}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
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
