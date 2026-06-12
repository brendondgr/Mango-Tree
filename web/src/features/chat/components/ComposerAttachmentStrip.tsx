import type { PendingAttachment } from "@/features/chat/types/attachment";
import { ComposerAttachmentChip } from "@/features/chat/components/ComposerAttachmentChip";
import { cn } from "@/lib/utils";

interface ComposerAttachmentStripProps {
  attachments: PendingAttachment[];
  onRemove: (id: string) => void;
}

export function ComposerAttachmentStrip({
  attachments,
  onRemove,
}: ComposerAttachmentStripProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="border-b border-border/60 px-3 py-2">
      <div
        className={cn(
          "flex flex-nowrap gap-2 overflow-x-auto pb-0.5",
          "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/60",
        )}
      >
        {attachments.map((pending) => (
          <ComposerAttachmentChip
            key={pending.id}
            pending={pending}
            onRemove={onRemove}
            className="max-w-[min(240px,70vw)] shrink-0"
          />
        ))}
      </div>
    </div>
  );
}
