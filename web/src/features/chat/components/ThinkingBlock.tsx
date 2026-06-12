import { ChevronDown, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { cn } from "@/lib/utils";

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

export function ThinkingBlock({ content, isStreaming = false }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(isStreaming);

  useEffect(() => {
    if (isStreaming) {
      setExpanded(true);
    }
  }, [isStreaming]);

  if (!content && !isStreaming) {
    return null;
  }

  return (
    <div className="mb-2 rounded-[var(--radius-md)] border border-border/70 bg-muted/40">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={expanded}
      >
        <Sparkles
          className={cn("h-3.5 w-3.5 shrink-0", isStreaming && "animate-pulse")}
          aria-hidden
        />
        <span className="flex-1">
          {isStreaming ? "Thinking…" : "Thought process"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {expanded && (
        <div className="border-t border-border/60 px-3 py-2 text-muted-foreground">
          {content ? (
            <MarkdownContent
              content={content}
              className="text-xs leading-relaxed [&_p]:text-muted-foreground"
            />
          ) : (
            <p className="text-xs italic text-muted-foreground/80">
              Working through the problem…
            </p>
          )}
          {isStreaming && (
            <span
              className="mt-1 inline-block h-3.5 w-0.5 animate-pulse bg-muted-foreground/70"
              aria-hidden
            />
          )}
        </div>
      )}
    </div>
  );
}
