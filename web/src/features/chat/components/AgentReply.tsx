import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { ThinkingBlock } from "@/features/chat/components/ThinkingBlock";
import { cn } from "@/lib/utils";

interface AgentReplyProps {
  content: string;
  thinking?: string;
  isStreaming?: boolean;
  timestamp: Date;
}

function formatChatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgentReply({
  content,
  thinking,
  isStreaming = false,
  timestamp,
}: AgentReplyProps) {
  const hasThinking = Boolean(thinking?.trim()) || (isStreaming && !content);
  const showWaiting = isStreaming && !content && !thinking?.trim();

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-start">
        <span className="text-[10px] text-muted-foreground/60">
          {formatChatTime(timestamp)}
        </span>
      </div>
      <div
        className={cn(
          "max-w-[95%] rounded-[var(--radius-lg)] rounded-bl-sm border border-border/60 bg-card px-3 py-2 shadow-sm",
          isStreaming && "border-primary/20",
        )}
      >
        {hasThinking && (
          <ThinkingBlock
            content={thinking ?? ""}
            isStreaming={isStreaming && !content}
          />
        )}
        {content ? (
          <MarkdownContent content={content} />
        ) : showWaiting ? (
          <p className="text-sm text-muted-foreground">Waiting for response…</p>
        ) : null}
        {isStreaming && content && (
          <span
            className="mt-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary/70 align-text-bottom"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
