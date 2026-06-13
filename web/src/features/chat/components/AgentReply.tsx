import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { ThinkingBlock } from "@/features/chat/components/ThinkingBlock";
import { ToolExecutionBlock } from "@/features/chat/components/ToolExecutionBlock";
import { cn } from "@/lib/utils";

interface AgentReplyProps {
  content: string;
  thinking?: string;
  isStreaming?: boolean;
  timestamp: Date;
  toolCalls?: { id: string; name: string; arguments: Record<string, any> }[];
  toolResults?: {
    tool: string;
    call_id: string;
    success: boolean;
    result: Record<string, any>;
    summary: string;
    artifact_ids: string[];
  }[];
  currentNode?: string;
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
  toolCalls,
  toolResults,
  currentNode,
}: AgentReplyProps) {
  const hasThinking = Boolean(thinking?.trim()) || (isStreaming && !content);
  const showWaiting = isStreaming && !content && !thinking?.trim();

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-0.5">
      <div className="flex justify-start">
        <span className="text-[10px] text-muted-foreground/60">
          {formatChatTime(timestamp)}
        </span>
      </div>
      <div
        className={cn(
          "min-w-0 max-w-full rounded-[var(--radius-lg)] border border-border/60 bg-card px-3 py-2 shadow-sm",
          isStreaming && "border-primary/20",
        )}
      >
        {((toolCalls && toolCalls.length > 0) || (toolResults && toolResults.length > 0)) && (
          <ToolExecutionBlock
            toolCalls={toolCalls ?? []}
            toolResults={toolResults ?? []}
            currentNode={currentNode}
            isStreaming={isStreaming}
          />
        )}
        {hasThinking && (
          <ThinkingBlock
            content={thinking ?? ""}
            isStreaming={isStreaming && !content}
          />
        )}
        {content ? (
          <MarkdownContent
            content={content}
            variant="chat"
            className="min-w-0 max-w-full break-words [overflow-wrap:anywhere] [&_pre]:overflow-x-auto [&_.katex-display]:overflow-x-auto"
          />
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
