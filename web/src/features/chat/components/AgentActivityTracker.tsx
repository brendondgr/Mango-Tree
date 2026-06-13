import { useState, useEffect } from "react";
import { Brain, Wrench, Sparkles, ChevronDown, CheckCircle2, XCircle, Loader2, Terminal } from "lucide-react";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { cn } from "@/lib/utils";

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

interface ToolResult {
  tool: string;
  call_id: string;
  success: boolean;
  result: Record<string, any>;
  summary: string;
  artifact_ids: string[];
}

interface AgentActivityTrackerProps {
  thinking: string;
  isStreaming?: boolean;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  currentNode?: string;
}

export function AgentActivityTracker({
  thinking,
  isStreaming = false,
  toolCalls = [],
  toolResults = [],
  currentNode,
}: AgentActivityTrackerProps) {
  const [expanded, setExpanded] = useState(isStreaming);

  // Auto-expand during live streaming/execution
  useEffect(() => {
    if (isStreaming) {
      setExpanded(true);
    }
  }, [isStreaming]);

  const hasThinking = Boolean(thinking?.trim());
  const hasTools = toolCalls.length > 0 || toolResults.length > 0;

  if (!hasThinking && !hasTools && !isStreaming) {
    return null;
  }

  const completedCount = toolResults.length;
  const totalCount = Math.max(toolCalls.length, toolResults.length);
  const isRunningTools = isStreaming && completedCount < totalCount;

  // Determine header status text and icon
  let HeaderIcon = Brain;
  let headerText = "Thought process";
  let statusBadge = null;

  if (isStreaming) {
    if (currentNode === "reason") {
      HeaderIcon = Sparkles;
      headerText = "Thinking…";
    } else if (currentNode === "act" || currentNode === "observe" || isRunningTools) {
      HeaderIcon = Wrench;
      headerText = `Executing tools (${completedCount}/${totalCount})…`;
    } else {
      HeaderIcon = Brain;
      headerText = "Mango running…";
    }
    statusBadge = (
      <span className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full animate-pulse border border-primary/20">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        {currentNode || "active"}
      </span>
    );
  } else {
    if (hasTools) {
      HeaderIcon = Terminal;
      headerText = `Executed ${completedCount} tool${completedCount === 1 ? "" : "s"}`;
      statusBadge = (
        <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium px-2 py-0.5 rounded-full border border-emerald-500/20">
          Done
        </span>
      );
    } else {
      HeaderIcon = Brain;
      headerText = "Thought process";
    }
  }

  // Create lookup map for tool results
  const resultMap = new Map(toolResults.map((r) => [r.call_id, r]));

  return (
    <div
      className={cn(
        "mb-3 min-w-0 max-w-full overflow-hidden rounded-[var(--radius-md)] border transition-all duration-300 shadow-sm",
        isStreaming
          ? "border-primary/30 bg-primary/5 shadow-md shadow-primary/5"
          : "border-border/60 bg-muted/20"
      )}
    >
      {/* Header Panel */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs font-semibold text-muted-foreground/80 transition-colors hover:text-foreground focus:outline-none"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2">
          <HeaderIcon className={cn("h-4 w-4", isStreaming && "text-primary animate-pulse")} />
          <span className="text-foreground/90 font-medium">{headerText}</span>
          {statusBadge}
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[10px] opacity-75">{expanded ? "Hide" : "Show"}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200 text-muted-foreground/60",
              expanded && "transform rotate-180"
            )}
          />
        </span>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="min-w-0 max-w-full overflow-hidden border-t border-border/50 px-3 py-2.5 space-y-3 bg-card/40">
          {/* Real-time Streaming Thoughts / Reasoning */}
          {hasThinking && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase flex items-center gap-1.5">
                <Brain className="h-3 w-3" />
                Reasoning
              </div>
              <div className="relative rounded-[var(--radius-sm)] bg-muted/30 dark:bg-muted/10 border border-border/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                <MarkdownContent
                  content={thinking}
                  className="min-w-0 max-w-full text-xs leading-relaxed [&_pre]:overflow-x-auto [&_.katex-display]:overflow-x-auto [&_p]:text-muted-foreground"
                />
                {isStreaming && currentNode === "reason" && (
                  <span
                    className="inline-block ml-0.5 h-3 w-1 bg-primary/70 animate-ping align-middle"
                    aria-hidden
                  />
                )}
              </div>
            </div>
          )}

          {/* Active Tool Executions / Timeline */}
          {hasTools && (
            <div className="space-y-2">
              <div className="text-[10px] font-bold tracking-wider text-muted-foreground/60 uppercase flex items-center gap-1.5">
                <Terminal className="h-3 w-3" />
                Tool Executions
              </div>
              <div className="space-y-2.5 border-l border-border/60 pl-2.5 ml-1.5">
                {toolCalls.map((call) => {
                  const res = resultMap.get(call.id);
                  const isPending = !res;

                  return (
                    <div key={call.id} className="relative flex items-start gap-2.5 group">
                      {/* Timeline dot */}
                      <span className="absolute -left-[14px] top-1.5 h-2 w-2 rounded-full border border-card bg-background flex items-center justify-center">
                        <span
                          className={cn(
                            "h-1 w-1 rounded-full",
                            isPending
                              ? "bg-primary animate-ping"
                              : res.success
                              ? "bg-emerald-500"
                              : "bg-rose-500"
                          )}
                        />
                      </span>

                      <span className="mt-0.5 shrink-0">
                        {isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        ) : res.success ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1 bg-muted/20 dark:bg-muted/5 rounded-[var(--radius-sm)] border border-border/30 px-2.5 py-1.5 hover:bg-muted/40 transition-colors">
                        <div className="font-mono text-[11px] text-foreground flex flex-wrap items-center gap-x-1.5 leading-normal">
                          <span className="font-semibold text-primary">{call.name}</span>
                          <span className="text-[10px] text-muted-foreground font-normal break-all">
                            {JSON.stringify(call.arguments)}
                          </span>
                        </div>
                        {!isPending && res.summary && (
                          <p className="text-muted-foreground text-[11px] leading-relaxed mt-1 border-t border-border/20 pt-1">
                            {res.summary}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
