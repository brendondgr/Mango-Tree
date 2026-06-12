import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ArtifactDeleteConfirmProps {
  filename: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  className?: string;
  layout?: "inline" | "stacked";
}

export function ArtifactDeleteConfirm({
  filename,
  isPending,
  onCancel,
  onConfirm,
  className,
  layout = "stacked",
}: ArtifactDeleteConfirmProps) {
  if (layout === "inline") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-end gap-2",
          className,
        )}
      >
        <p className="mr-auto text-xs text-muted-foreground">
          Delete <span className="font-medium text-foreground">{filename}</span>?
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={isPending}
          onClick={onConfirm}
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-center",
        className,
      )}
    >
      <p className="text-xs font-medium text-foreground">Delete artifact?</p>
      <p className="line-clamp-2 text-[10px] text-muted-foreground">{filename}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={isPending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={isPending}
          onClick={onConfirm}
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
        </Button>
      </div>
    </div>
  );
}
