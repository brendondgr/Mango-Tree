import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChatReference } from "@/features/chat/utils/formatReplyMarkdown";
import { formatReplyMarkdown } from "@/features/chat/utils/formatReplyMarkdown";

interface CopyReplyMenuProps {
  content: string;
  references?: ChatReference[];
}

export function CopyReplyMenu({ content, references }: CopyReplyMenuProps) {
  const [copiedMode, setCopiedMode] = useState<"with" | "without" | null>(null);

  const copyMarkdown = useCallback(
    async (includeCitations: boolean) => {
      const markdown = formatReplyMarkdown(content, references, {
        includeCitations,
      });
      await navigator.clipboard.writeText(markdown);
      setCopiedMode(includeCitations ? "with" : "without");
      window.setTimeout(() => setCopiedMode(null), 1500);
    },
    [content, references],
  );

  const copied = copiedMode !== null;

  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
            aria-label="Copy reply"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied
              ? copiedMode === "with"
                ? "Copied with citations"
                : "Copied without citations"
              : "Copy"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => void copyMarkdown(true)}>
            Copy with citations
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void copyMarkdown(false)}>
            Copy without citations
          </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
  );
}
