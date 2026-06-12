import type { LlmStreamDelta } from "@/services/llmTypes";

interface RawStreamChoice {
  delta?: Record<string, unknown>;
  message?: Record<string, unknown>;
}

interface RawStreamChunk {
  choices?: RawStreamChoice[];
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function pickReasoningFields(source: Record<string, unknown> | undefined): string | undefined {
  if (!source) return undefined;
  return (
    readString(source.reasoning_content) ??
    readString(source.reasoning) ??
    readString(source.thinking)
  );
}

/** Extract content and reasoning deltas from one OpenAI-compatible SSE JSON payload. */
export function parseLlmStreamChunk(payload: string): LlmStreamDelta | null {
  const trimmed = payload.trim();
  if (!trimmed || trimmed === "[DONE]") {
    return null;
  }

  let parsed: RawStreamChunk;
  try {
    parsed = JSON.parse(trimmed) as RawStreamChunk;
  } catch {
    return null;
  }

  const choice = parsed.choices?.[0];
  if (!choice) return null;

  const delta = choice.delta;
  const message = choice.message;

  const thinking =
    pickReasoningFields(delta) ?? pickReasoningFields(message) ?? undefined;
  const content = readString(delta?.content) ?? readString(message?.content);

  if (!thinking && !content) {
    return null;
  }

  return { thinking, content };
}

export function extractCompletionFields(data: {
  choices?: Array<{ message?: Record<string, unknown> }>;
}): { content: string; thinking: string } {
  const message = data.choices?.[0]?.message ?? {};
  const thinking =
    readString(message.reasoning_content) ??
    readString(message.reasoning) ??
    readString(message.thinking) ??
    "";
  const content = readString(message.content) ?? "";

  return { content, thinking };
}
