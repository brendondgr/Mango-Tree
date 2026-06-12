import { resolveChatCompletionsUrl } from "@/services/llmEndpoints";
import {
  extractCompletionFields,
  extractUsageFromCompletion,
  extractUsageFromPayload,
  parseLlmStreamChunk,
} from "@/services/parseLlmStreamChunk";
import { ThinkTagStreamSplitter } from "@/services/parseThinkTagStream";
import type {
  LlmChatCompletionResponse,
  LlmChatMessage,
  LlmConfig,
  LlmStreamCallbacks,
  LlmStreamResult,
  LlmUsage,
} from "@/services/llmTypes";

export class LlmClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmClientError";
  }
}

function buildHeaders(config: LlmConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  }
  return headers;
}

async function readSseStream(
  body: ReadableStream<Uint8Array>,
  onPayload: (payload: string) => void,
): Promise<void> {
  const reader = body.getReader();
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
      onPayload(trimmed.slice(5).trim());
    }
  }

  const trailing = buffer.trim();
  if (trailing.startsWith("data:")) {
    onPayload(trailing.slice(5).trim());
  }
}

function applyStreamDelta(
  delta: { content?: string; thinking?: string },
  callbacks: LlmStreamCallbacks,
  thinkSplitter: ThinkTagStreamSplitter,
  state: { content: string; thinking: string },
): void {
  if (delta.thinking) {
    state.thinking += delta.thinking;
    callbacks.onThinkingDelta?.(delta.thinking);
  }

  if (delta.content) {
    const split = thinkSplitter.push(delta.content);
    const thinkingDelta = split.thinking.slice(state.thinking.length);
    const contentDelta = split.content.slice(state.content.length);

    if (thinkingDelta) {
      state.thinking = split.thinking;
      callbacks.onThinkingDelta?.(thinkingDelta);
    }
    if (contentDelta) {
      state.content = split.content;
      callbacks.onContentDelta?.(contentDelta);
    }
  }
}

export async function queryLlm(
  messages: LlmChatMessage[],
  config: LlmConfig,
): Promise<string> {
  const result = await streamLlm(messages, config);
  return result.content;
}

export async function streamLlm(
  messages: LlmChatMessage[],
  config: LlmConfig,
  callbacks: LlmStreamCallbacks = {},
  signal?: AbortSignal,
): Promise<LlmStreamResult> {
  const url = resolveChatCompletionsUrl(config.baseUrl);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        model: config.model,
        messages,
        stream: true,
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new LlmClientError(
      `Could not reach LLM at ${url}. Check that the server is running and the base URL is correct.`,
    );
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new LlmClientError(
      `LLM request failed (${response.status}): ${detail || response.statusText}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    let data: LlmChatCompletionResponse;
    try {
      data = (await response.json()) as LlmChatCompletionResponse;
    } catch {
      throw new LlmClientError("LLM returned invalid JSON");
    }

    const { content, thinking } = extractCompletionFields(data);
    if (thinking) callbacks.onThinkingDelta?.(thinking);
    if (content) callbacks.onContentDelta?.(content);
    const usage = extractUsageFromCompletion(data) ?? undefined;
    return { content, thinking, usage };
  }

  if (!response.body) {
    throw new LlmClientError("LLM stream response had no body");
  }

  const state = { content: "", thinking: "" };
  const thinkSplitter = new ThinkTagStreamSplitter();
  let usage: LlmUsage | undefined;

  await readSseStream(response.body, (payload) => {
    const streamUsage = extractUsageFromPayload(payload);
    if (streamUsage) usage = streamUsage;

    const delta = parseLlmStreamChunk(payload);
    if (!delta) return;
    applyStreamDelta(delta, callbacks, thinkSplitter, state);
  });

  const finalSplit = thinkSplitter.finish();
  const thinkingDelta = finalSplit.thinking.slice(state.thinking.length);
  const contentDelta = finalSplit.content.slice(state.content.length);

  if (thinkingDelta) {
    state.thinking = finalSplit.thinking;
    callbacks.onThinkingDelta?.(thinkingDelta);
  }
  if (contentDelta) {
    state.content = finalSplit.content;
    callbacks.onContentDelta?.(contentDelta);
  }

  return { content: state.content, thinking: state.thinking, usage };
}
