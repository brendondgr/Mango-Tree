import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CitationBadge } from "@/features/chat/components/CitationBadge";
import type { ChatReference } from "@/features/chat/utils/formatReplyMarkdown";
import { cn } from "@/lib/utils";

interface ReferencesDialogProps {
  references: ChatReference[];
  className?: string;
}

function referenceLabel(count: number): string {
  return count === 1 ? "1 Reference" : `${count} References`;
}

export function ReferencesDialog({
  references,
  className,
}: ReferencesDialogProps) {
  if (references.length === 0) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-7 rounded-full px-2.5 text-xs font-medium",
            className,
          )}
        >
          {referenceLabel(references.length)}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(80vh,32rem)] gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-base">
            {referenceLabel(references.length)}
          </DialogTitle>
        </DialogHeader>
        <ol className="max-h-[min(70vh,28rem)] overflow-y-auto px-2 py-2">
          {references.map((reference) => (
            <li key={`${reference.index}-${reference.url}`}>
              <a
                href={reference.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-start gap-3 rounded-[var(--radius-md)] px-2 py-2.5 transition-colors hover:bg-muted/60"
              >
                <CitationBadge
                  index={reference.index}
                  url={reference.url}
                  asSpan
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug text-foreground">
                    {reference.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    <span className="min-w-0 break-all">{reference.url}</span>
                    <ExternalLink
                      className="h-3 w-3 shrink-0 opacity-70"
                      aria-hidden
                    />
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
