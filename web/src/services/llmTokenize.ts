import { resolveTokenizeUrl } from "@/services/llmEndpoints";
import type { LlmChatMessage, LlmConfig } from "@/services/llmTypes";

export interface TokenizeResult {
  count: number;
  maxModelLen: number | null;
  source: "server";
}

interface TokenizeResponse {
  count?: number;
  tokens?: number[];
  max_model_len?: number;
}

function buildHeaders(config: LlmConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.apiKey.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  }
  return headers;
}

/** Count tokens via vLLM /tokenize (model-native tokenizer + chat template). */
export async function tokenizeMessages(
  messages: LlmChatMessage[],
  config: LlmConfig,
  signal?: AbortSignal,
): Promise<TokenizeResult | null> {
  const url = resolveTokenizeUrl(config.baseUrl);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(config),
      body: JSON.stringify({
        model: config.model,
        messages,
      }),
      signal,
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let data: TokenizeResponse;
  try {
    data = (await response.json()) as TokenizeResponse;
  } catch {
    return null;
  }

  const count =
    typeof data.count === "number"
      ? data.count
      : Array.isArray(data.tokens)
        ? data.tokens.length
        : null;

  if (count == null) {
    return null;
  }

  return {
    count,
    maxModelLen:
      typeof data.max_model_len === "number" ? data.max_model_len : null,
    source: "server",
  };
}
