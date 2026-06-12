import { useState } from "react";

import { MarkdownContent } from "@/components/markdown/MarkdownContent";

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

export function ThinkingBlock({ content, isStreaming = false }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);

  if (!content && !isStreaming) {
    return null;
  }

  return (
    <div className="mb-2 min-w-0 max-w-full overflow-hidden rounded-[var(--radius-md)] border border-border/70 bg-muted/40">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={expanded}
      >
        {isStreaming ? "Thinking…" : "Thought process"}
      </button>
      {expanded && (
        <div className="min-w-0 max-w-full overflow-x-auto border-t border-border/60 px-3 py-2 text-muted-foreground">
          {content ? (
            <MarkdownContent
              content={content}
              className="min-w-0 max-w-full text-xs leading-relaxed break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_pre]:overflow-x-auto [&_.katex-display]:overflow-x-auto [&_p]:text-muted-foreground"
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
