import type { ToolResult } from "./types";

/**
 * Formats a list of ToolResults into a clean markdown-compatible string for rendering in the chat UI.
 */
export function formatToolObservations(results: ToolResult[]): string {
  if (results.length === 0) return "";
  
  return results
    .map((res) => {
      const statusIcon = res.success ? "✅" : "❌";
      const summaryText = res.summary || `Executed tool: ${res.tool}`;
      
      let artifactInfo = "";
      if (res.artifact_ids && res.artifact_ids.length > 0) {
        artifactInfo = `\n   *Artifacts:* ${res.artifact_ids.join(", ")}`;
      }
      
      return `${statusIcon} **[${res.tool}]** ${summaryText}${artifactInfo}`;
    })
    .join("\n\n");
}

/**
 * Normalizes tool results into descriptive log items suitable for status/progress rendering.
 */
export interface ToolStatusLog {
  id: string;
  name: string;
  status: "running" | "success" | "failed";
  summary: string;
}

export function getToolStatusLogs(calls: any[], results: ToolResult[]): ToolStatusLog[] {
  const resultIdMap = new Map(results.map((r) => [r.call_id, r]));
  
  return calls.map((call) => {
    const res = resultIdMap.get(call.id);
    if (!res) {
      return {
        id: call.id,
        name: call.name,
        status: "running" as const,
        summary: `Executing ${call.name}…`
      };
    }
    
    return {
      id: call.id,
      name: call.name,
      status: res.success ? ("success" as const) : ("failed" as const),
      summary: res.summary
    };
  });
}
