/**
 * Client for the agent tool-group catalogue (GET /api/tools/groups/).
 *
 * The catalogue describes which tool groups exist and their defaults; the
 * enabled set itself is client state (see workspaceStore) sent per turn on the
 * agent_turn request. See docs/tool-groups.md.
 */

export interface ToolGroupInfo {
  id: string;
  label: string;
  tools: string[];
  default_enabled: boolean;
  /** A session capability the group is gated behind (D15); absent when open. */
  requires?: string;
}

interface ToolGroupsResponse {
  groups: ToolGroupInfo[];
}

export async function fetchToolGroups(): Promise<ToolGroupInfo[]> {
  const response = await fetch("/api/tools/groups/", { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to load tool groups (${response.status})`);
  }
  const body = (await response.json()) as ToolGroupsResponse;
  return body.groups ?? [];
}
