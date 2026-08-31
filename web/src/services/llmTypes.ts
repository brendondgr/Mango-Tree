export interface LlmConfig {
  /**
   * Slug of the provider chosen in Settings. This is what an agent turn sends;
   * the server resolves the endpoint and the key from its own registry, so no
   * secret crosses the wire.
   */
  providerSlug: string;
  /** Display-only. Resolved from the provider list, never sent as a selector. */
  baseUrl: string;
  model: string;
  apiKey: string;
  /** Manual override when the server does not expose max context length. */
  maxContextTokens?: number | null;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type LlmContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface LlmChatMessage {
  role: "user" | "assistant" | "system";
  content: string | LlmContentPart[];
}

export interface LlmChatCompletionResponse {
  choices: Array<{
    message: {
      content?: string;
      reasoning_content?: string;
      reasoning?: string;
      thinking?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export interface LlmStreamDelta {
  content?: string;
  thinking?: string;
  usage?: LlmUsage;
}

export interface LlmStreamCallbacks {
  onThinkingDelta?: (delta: string) => void;
  onContentDelta?: (delta: string) => void;
}

export interface LlmStreamResult {
  content: string;
  thinking: string;
  usage?: LlmUsage;
}
