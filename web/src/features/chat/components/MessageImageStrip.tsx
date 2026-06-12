import type { ChatAttachment } from "@/features/chat/types/attachment";
import { cn } from "@/lib/utils";

interface MessageImageStripProps {
  images: ChatAttachment[];
  variant: "user" | "agent";
  onImageClick: (index: number) => void;
}

export function MessageImageStrip({
  images,
  variant,
  onImageClick,
}: MessageImageStripProps) {
  if (images.length === 0) return null;

  return (
    <div
      className={cn(
        "mb-2 flex max-h-16 gap-1.5 overflow-x-auto pb-0.5",
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/60",
      )}
    >
      {images.map((image, index) => (
        <button
          key={image.id}
          type="button"
          className={cn(
            "shrink-0 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            variant === "user"
              ? "ring-offset-primary hover:opacity-90"
              : "ring-offset-background hover:opacity-90",
          )}
          aria-label={`View ${image.name}`}
          title={image.name}
          onClick={() => onImageClick(index)}
        >
          <img
            src={image.previewUrl}
            alt={image.name}
            className="h-16 w-16 object-cover"
          />
        </button>
      ))}
    </div>
  );
}
