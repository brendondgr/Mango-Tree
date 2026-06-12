export interface LlmConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
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
}

export interface LlmStreamDelta {
  content?: string;
  thinking?: string;
}

export interface LlmStreamCallbacks {
  onThinkingDelta?: (delta: string) => void;
  onContentDelta?: (delta: string) => void;
}

export interface LlmStreamResult {
  content: string;
  thinking: string;
}
