import type { LlmStreamDelta, LlmUsage } from "@/services/llmTypes";

interface RawStreamChoice {
  delta?: Record<string, unknown>;
  message?: Record<string, unknown>;
}

interface RawUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface RawStreamChunk {
  choices?: RawStreamChoice[];
  usage?: RawUsage;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseUsage(raw: RawStreamChunk["usage"]): LlmUsage | undefined {
  if (!raw) return undefined;
  const promptTokens = raw.prompt_tokens;
  const completionTokens = raw.completion_tokens;
  const totalTokens = raw.total_tokens;
  if (
    typeof promptTokens !== "number" ||
    typeof completionTokens !== "number" ||
    typeof totalTokens !== "number"
  ) {
    return undefined;
  }
  return { promptTokens, completionTokens, totalTokens };
}

function pickReasoningFields(source: Record<string, unknown> | undefined): string | undefined {
  if (!source) return undefined;
  return (
    readString(source.reasoning_content) ??
    readString(source.reasoning) ??
    readString(source.thinking)
  );
}

function readUsage(source: RawUsage | undefined): LlmUsage | null {
  if (!source) return null;
  const promptTokens = source.prompt_tokens;
  const completionTokens = source.completion_tokens;
  const totalTokens = source.total_tokens;
  if (
    typeof promptTokens !== "number" ||
    typeof completionTokens !== "number" ||
    typeof totalTokens !== "number"
  ) {
    return null;
  }
  return { promptTokens, completionTokens, totalTokens };
}

/** Extract token usage from an OpenAI-compatible completion or SSE payload. */
export function extractUsageFromPayload(payload: string): LlmUsage | null {
  const trimmed = payload.trim();
  if (!trimmed || trimmed === "[DONE]") return null;

  let parsed: RawStreamChunk;
  try {
    parsed = JSON.parse(trimmed) as RawStreamChunk;
  } catch {
    return null;
  }

  return readUsage(parsed.usage);
}

export function extractUsageFromCompletion(data: {
  usage?: RawUsage;
}): LlmUsage | null {
  return readUsage(data.usage);
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

  const usage = parseUsage(parsed.usage);
  const choice = parsed.choices?.[0];

  if (!choice && !usage) {
    return null;
  }

  const delta = choice?.delta;
  const message = choice?.message;

  const thinking =
    pickReasoningFields(delta) ?? pickReasoningFields(message) ?? undefined;
  const content = readString(delta?.content) ?? readString(message?.content);

  if (!thinking && !content && !usage) {
    return null;
  }

  return { thinking, content, usage };
}

export function extractCompletionFields(data: {
  choices?: Array<{ message?: Record<string, unknown> }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}): { content: string; thinking: string; usage?: LlmUsage } {
  const message = data.choices?.[0]?.message ?? {};
  const thinking =
    readString(message.reasoning_content) ??
    readString(message.reasoning) ??
    readString(message.thinking) ??
    "";
  const content = readString(message.content) ?? "";
  const usage = parseUsage(data.usage);

  return { content, thinking, usage };
}
