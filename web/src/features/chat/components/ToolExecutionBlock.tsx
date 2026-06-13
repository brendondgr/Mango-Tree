import { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

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

interface ToolExecutionBlockProps {
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  currentNode?: string;
  isStreaming?: boolean;
}

export function ToolExecutionBlock({
  toolCalls,
  toolResults,
  currentNode,
  isStreaming = false,
}: ToolExecutionBlockProps) {
  const [expanded, setExpanded] = useState(true);

  if (toolCalls.length === 0 && toolResults.length === 0) {
    return null;
  }

  const completedCount = toolResults.length;
  const totalCount = Math.max(toolCalls.length, toolResults.length);
  const isRunning = isStreaming && completedCount < totalCount;

  let headerText = "";
  if (isRunning) {
    headerText = `Executing tools (${completedCount}/${totalCount})…`;
    if (currentNode) {
      headerText += ` [${currentNode}]`;
    }
  } else {
    headerText = `Executed ${completedCount} tool${completedCount === 1 ? "" : "s"}`;
  }

  // Create lookup map for tool results
  const resultMap = new Map(toolResults.map((r) => [r.call_id, r]));

  return (
    <div className="mb-2 min-w-0 max-w-full overflow-hidden rounded-[var(--radius-md)] border border-border/70 bg-muted/20">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground flex items-center justify-between"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-1.5">
          {isRunning && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          {headerText}
        </span>
        <span className="text-[10px] opacity-75">{expanded ? "Hide" : "Show"}</span>
      </button>
      {expanded && (
        <div className="min-w-0 max-w-full overflow-hidden border-t border-border/60 px-3 py-2 text-xs text-muted-foreground space-y-2">
          {toolCalls.map((call) => {
            const res = resultMap.get(call.id);
            const isPending = !res;

            return (
              <div key={call.id} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/60" />
                  ) : res.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground flex flex-wrap items-center gap-x-1.5">
                    <span>{call.name}</span>
                    <span className="text-[10px] text-muted-foreground font-normal break-all">
                      ({JSON.stringify(call.arguments)})
                    </span>
                  </div>
                  {!isPending && res.summary && (
                    <p className="text-muted-foreground text-[11px] leading-normal mt-0.5">
                      {res.summary}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
