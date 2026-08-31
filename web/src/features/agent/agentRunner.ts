import type { LlmConfig } from "@/services/llmTypes";

import { useAgentStore } from "./agentState";
import type { AgentEvent, ChatReference } from "./types";

/**
 * Triggers a backend agent execution turn and processes the live Server-Sent Events (SSE) stream,
 * updating the client-side useAgentStore with the agent's thoughts, tool calls, and observations.
 */
export async function runAgentTurn(
  chatSessionId: string,
  userMessage: string,
  history: { role: "user" | "agent"; content: string; thinking?: string; attachments?: any[] }[],
  attachments?: any[],
  webSearchMode: "auto" | "forced" = "auto",
  llmConfig?: LlmConfig,
  enabledGroups?: string[],
  workspaceId?: string | null,
): Promise<void> {
  const store = useAgentStore.getState();
  store.reset();
  store.setStatus("running");

  // Send the PROVIDER SLUG, not an endpoint, and never a key. The server
  // resolves the endpoint, the credential and the adapter from its own
  // registry. Sending a base URL took the backend's deprecated inline path,
  // which ignores the owner's stored key and hardcodes the OpenAI-compatible
  // adapter — so a hosted provider or an authenticated local one would 401 on
  // every turn even though "Test connection" passed.
  //
  // Omitting llm_config entirely means "use the registry default", which is the
  // right behaviour before the settings panel has ever been opened.
  const provider = llmConfig?.providerSlug.trim();
  const model = llmConfig?.model.trim();
  const llmConfigPayload =
    provider || model
      ? {
          ...(provider ? { provider } : {}),
          ...(model ? { model } : {}),
        }
      : undefined;

  try {
    const response = await fetch(`/api/agent/${chatSessionId}/agent_turn/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: userMessage,
        history,
        attachments,
        web_search_mode: webSearchMode,
        ...(enabledGroups ? { enabled_groups: enabledGroups } : {}),
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
        ...(llmConfigPayload ? { llm_config: llmConfigPayload } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      store.setError(`Backend agent failed: ${errorText || response.statusText}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      store.setError("Response stream is not readable.");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const rawJson = trimmed.slice(5).trim();
        if (!rawJson) continue;

        try {
          const parsed = JSON.parse(rawJson);
          if (parsed && typeof parsed === "object" && "event" in parsed) {
            handleAgentEvent(parsed as AgentEvent);
          }
        } catch (e) {
          console.warn("Failed to parse SSE event payload:", rawJson, e);
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run agent loop.";
    store.setError(message);
  }
}

function normalizeReferences(
  references: ChatReference[] | undefined,
): ChatReference[] {
  return (references ?? []).map((reference) => ({
    index: Number(reference.index),
    title: reference.title,
    url: reference.url,
  }));
}

function handleAgentEvent(event: AgentEvent) {
  const store = useAgentStore.getState();
  switch (event.event) {
    case "node_start":
      store.setNode(event.payload.node);
      break;
    case "thinking_delta":
      store.appendThinking(event.payload.content);
      break;
    case "tool_call":
      store.addToolCall(event.payload);
      break;
    case "tool_result":
      store.addToolResult(event.payload);
      break;
    case "final_answer":
      store.setFinalAnswer(
        event.payload.text,
        normalizeReferences(event.payload.references),
      );
      break;
    case "error":
      store.setError(event.payload.message);
      break;
  }
}
