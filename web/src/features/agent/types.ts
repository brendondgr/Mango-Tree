export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ChatReference {
  index: number;
  title: string;
  url: string;
}

export interface ToolResult {
  tool: string;
  call_id: string;
  success: boolean;
  result: Record<string, any>;
  summary: string;
  artifact_ids: string[];
}

/**
 * The turn's tool-group decision, streamed as `tool_groups_selected`: which
 * groups are in force, which the user pinned, which the router (or a mid-turn
 * request) added, and why. See docs/tool-groups.md (D16).
 */
export interface ToolGroupSelection {
  groups: string[];
  pinned: string[];
  selected: string[];
  reason: string;
  source: "model" | "keyword_fallback" | "no_candidates" | "manual" | "model_request" | string;
  model?: string;
}

export interface AgentMessage {
  role: "user" | "agent";
  content: string;
  thinking?: string;
}

export type AgentEvent =
  | { event: "node_start"; payload: { node: string } }
  | { event: "thinking_start"; payload: Record<string, never> }
  | { event: "thinking_delta"; payload: { content: string } }
  | { event: "tool_call"; payload: ToolCall }
  | { event: "tool_result"; payload: ToolResult }
  | { event: "tool_groups_selected"; payload: ToolGroupSelection }
  | { event: "final_answer"; payload: { text: string; references?: ChatReference[] } }
  | { event: "error"; payload: { message: string; traceback?: string } };
