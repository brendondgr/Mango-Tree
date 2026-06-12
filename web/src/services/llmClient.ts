import type {
  LlmChatCompletionResponse,
  LlmChatMessage,
  LlmConfig,
} from "@/services/llmTypes";

export class LlmClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmClientError";
  }
}

function resolveEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/$/, "");
  if (
    !trimmed ||
    trimmed === "/v1" ||
    /^https?:\/\/(localhost|127\.0\.0\.1):9090\/v1$/i.test(trimmed)
  ) {
    return "/v1/chat/completions";
  }
  return `${trimmed}/chat/completions`;
}

export async function queryLlm(
  messages: LlmChatMessage[],
  config: LlmConfig,
): Promise<string> {
  const url = resolveEndpoint(config.baseUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model,
        messages,
      }),
    });
  } catch {
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

  let data: LlmChatCompletionResponse;
  try {
    data = (await response.json()) as LlmChatCompletionResponse;
  } catch {
    throw new LlmClientError("LLM returned invalid JSON");
  }

  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new LlmClientError("Unexpected LLM response shape");
  }

  return content;
}
