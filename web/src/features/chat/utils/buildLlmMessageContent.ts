import type { ChatMessage } from "@/app/stores/workspaceStore";
import type { ChatAttachment } from "@/features/chat/types/attachment";
import type { LlmChatMessage, LlmContentPart } from "@/services/llmTypes";

function wrapTextAttachment(attachment: ChatAttachment): string {
  const lang = attachment.language ?? "text";
  const body = attachment.textContent ?? "";
  return `[Attached file: ${attachment.name}]\n\`\`\`${lang}\n${body}\n\`\`\``;
}

function buildUserContent(
  text: string,
  attachments?: ChatAttachment[],
): string | LlmContentPart[] {
  const parts: LlmContentPart[] = [];

  if (text.trim()) {
    parts.push({ type: "text", text: text.trim() });
  }

  for (const attachment of attachments ?? []) {
    if (attachment.error) continue;

    if (attachment.kind === "image" && attachment.dataUrl) {
      parts.push({
        type: "image_url",
        image_url: { url: attachment.dataUrl },
      });
      continue;
    }

    if (attachment.kind === "video") {
      if (attachment.dataUrl) {
        parts.push({
          type: "image_url",
          image_url: { url: attachment.dataUrl },
        });
      } else if (attachment.llmNote) {
        parts.push({ type: "text", text: attachment.llmNote });
      }
      continue;
    }

    if (
      (attachment.kind === "text" || attachment.kind === "pdf") &&
      attachment.textContent
    ) {
      parts.push({ type: "text", text: wrapTextAttachment(attachment) });
    }
  }

  if (parts.length === 0) {
    return text.trim();
  }

  if (parts.length === 1 && parts[0]?.type === "text") {
    return parts[0].text;
  }

  return parts;
}

export function buildLlmMessages(messages: ChatMessage[]): LlmChatMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "agent")
    .map((message) => {
      if (message.role === "agent") {
        return {
          role: "assistant" as const,
          content: message.content,
        };
      }

      return {
        role: "user" as const,
        content: buildUserContent(message.content, message.attachments),
      };
    });
}

export function isVisionUnsupportedError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("image") ||
    lower.includes("vision") ||
    lower.includes("multimodal") ||
    lower.includes("content type") ||
    lower.includes("unsupported")
  );
}

export function formatLlmError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : "Something went wrong while contacting the model.";

  if (isVisionUnsupportedError(message)) {
    return `${message}\n\nTip: This model may not support images. Try a vision-capable model or send text-only attachments.`;
  }

  return message;
}
