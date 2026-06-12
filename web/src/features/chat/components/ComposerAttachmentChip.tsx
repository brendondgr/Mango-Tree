import { FileText, Film, ImageIcon, Loader2, X } from "lucide-react";

import type {
  AttachmentKind,
  PendingAttachment,
} from "@/features/chat/types/attachment";
import { formatBytes } from "@/features/chat/utils/fileType";
import { cn } from "@/lib/utils";

function AttachmentIcon({ kind }: { kind?: AttachmentKind }) {
  switch (kind) {
    case "image":
      return <ImageIcon className="h-3.5 w-3.5 shrink-0" />;
    case "video":
      return <Film className="h-3.5 w-3.5 shrink-0" />;
    default:
      return <FileText className="h-3.5 w-3.5 shrink-0" />;
  }
}

interface ComposerAttachmentChipProps {
  pending: PendingAttachment;
  onRemove: (id: string) => void;
  className?: string;
}

export function ComposerAttachmentChip({
  pending,
  onRemove,
  className,
}: ComposerAttachmentChipProps) {
  const attachment = pending.attachment;
  const isError = pending.status === "error";
  const isProcessing = pending.status === "processing";

  return (
    <div
      className={cn(
        "group relative flex max-w-full items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
        isError
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-border bg-muted/40 text-foreground",
        className,
      )}
    >
      {isProcessing ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : attachment?.kind === "image" && attachment.previewUrl ? (
        <img
          src={attachment.previewUrl}
          alt=""
          className="h-8 w-8 shrink-0 rounded object-cover"
        />
      ) : attachment?.kind === "video" && attachment.previewUrl ? (
        <video
          src={attachment.previewUrl}
          className="h-8 w-12 shrink-0 rounded object-cover"
          muted
        />
      ) : (
        <AttachmentIcon kind={attachment?.kind} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{pending.file.name}</p>
        <p className="text-[10px] text-muted-foreground">
          {isError
            ? pending.error
            : isProcessing
              ? "Processing…"
              : formatBytes(pending.file.size)}
        </p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`Remove ${pending.file.name}`}
        onClick={() => onRemove(pending.id)}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
