import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import type { ChatAttachment } from "@/features/chat/types/attachment";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface MessageImageLightboxProps {
  images: ChatAttachment[];
  open: boolean;
  initialIndex: number;
  onOpenChange: (open: boolean) => void;
}

export function MessageImageLightbox({
  images,
  open,
  initialIndex,
  onOpenChange,
}: MessageImageLightboxProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activeImage = images[activeIndex];
  const hasMultiple = images.length > 1;

  useEffect(() => {
    if (open) {
      setActiveIndex(initialIndex);
    }
  }, [open, initialIndex]);

  useEffect(() => {
    if (!open || images.length === 0) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((index) => (index > 0 ? index - 1 : images.length - 1));
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((index) => (index < images.length - 1 ? index + 1 : 0));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, images.length]);

  if (!activeImage?.previewUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-4xl gap-0 overflow-hidden border-border/60 bg-card p-0 sm:rounded-[var(--radius-lg)]",
          "grid-cols-1 [&>button:last-child]:right-3 [&>button:last-child]:top-3 [&>button:last-child]:text-foreground",
        )}
      >
        <DialogTitle className="sr-only">
          {activeImage.name} ({activeIndex + 1} of {images.length})
        </DialogTitle>
        <DialogDescription className="sr-only">
          Image preview carousel. Use arrow keys to navigate between images.
        </DialogDescription>

        <div className="relative flex min-h-[200px] items-center justify-center bg-muted/30 px-12 py-8">
          {hasMultiple && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/80 shadow-sm"
              aria-label="Previous image"
              onClick={() =>
                setActiveIndex((index) =>
                  index > 0 ? index - 1 : images.length - 1,
                )
              }
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}

          <img
            src={activeImage.previewUrl}
            alt={activeImage.name}
            className="max-h-[80vh] max-w-full object-contain"
          />

          {hasMultiple && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/80 shadow-sm"
              aria-label="Next image"
              onClick={() =>
                setActiveIndex((index) =>
                  index < images.length - 1 ? index + 1 : 0,
                )
              }
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
          <p className="min-w-0 truncate text-sm font-medium">{activeImage.name}</p>
          {hasMultiple && (
            <p className="shrink-0 text-xs text-muted-foreground">
              {activeIndex + 1} / {images.length}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
