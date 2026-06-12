import { getEncoding } from "js-tiktoken";

import type { LlmChatMessage } from "@/services/llmTypes";

let encoding: ReturnType<typeof getEncoding> | null = null;

function getCl100kEncoding() {
  if (!encoding) {
    encoding = getEncoding("cl100k_base");
  }
  return encoding;
}

function serializeMessageContent(
  content: LlmChatMessage["content"],
): string {
  if (typeof content === "string") return content;
  return content
    .map((part) => {
      if (part.type === "text") return part.text;
      return "[image]";
    })
    .join("\n");
}

function serializeMessages(messages: LlmChatMessage[]): string {
  return messages
    .map(
      (message) =>
        `${message.role}: ${serializeMessageContent(message.content)}`,
    )
    .join("\n\n");
}

/** Client-side token estimate when the server tokenize endpoint is unavailable. */
export function estimateMessageTokens(messages: LlmChatMessage[]): {
  count: number;
  method: "tiktoken" | "chars";
} {
  if (messages.length === 0) {
    return { count: 0, method: "tiktoken" };
  }

  const text = serializeMessages(messages);

  try {
    const enc = getCl100kEncoding();
    return { count: enc.encode(text).length, method: "tiktoken" };
  } catch {
    return { count: Math.ceil(text.length / 4), method: "chars" };
  }
}
