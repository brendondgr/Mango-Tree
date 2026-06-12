import { Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ComposerAttachmentChip } from "@/features/chat/components/ComposerAttachmentChip";
import type { PendingAttachment } from "@/features/chat/types/attachment";
import { cn } from "@/lib/utils";

interface ComposerAttachmentPillProps {
  attachments: PendingAttachment[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export function ComposerAttachmentPill({
  attachments,
  onRemove,
  disabled = false,
}: ComposerAttachmentPillProps) {
  if (attachments.length === 0) return null;

  const count = attachments.length;
  const label = count === 1 ? "1 attachment" : `${count} attachments`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-8 shrink-0 gap-1.5 rounded-full px-2.5 text-xs font-medium",
          )}
          aria-label={label}
        >
          <Paperclip className="h-3.5 w-3.5" />
          <span>{count}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-72 p-2">
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
          {label}
        </p>
        <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
          {attachments.map((pending) => (
            <ComposerAttachmentChip
              key={pending.id}
              pending={pending}
              onRemove={onRemove}
            />
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
