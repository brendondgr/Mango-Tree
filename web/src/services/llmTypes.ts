export interface LlmConfig {
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
