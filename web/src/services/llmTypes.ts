export interface LlmConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface LlmChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LlmChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}
