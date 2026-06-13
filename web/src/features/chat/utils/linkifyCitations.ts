import type { ChatReference } from "@/features/chat/utils/formatReplyMarkdown";

const CITATION_PATTERN = /\[(\d+)\]/g;
const FENCED_CODE_PATTERN = /(```[\s\S]*?```)/g;
const INLINE_CODE_PATTERN = /(`[^`\n]+`)/g;

/**
 * Turns inline [n] citation markers into markdown links (cite:n) outside code spans.
 * MarkdownContent renders cite: links as circular CitationBadge components.
 */
export function linkifyCitations(
  content: string,
  references: ChatReference[],
): string {
  if (references.length === 0) return content;

  const indexSet = new Set(references.map((ref) => ref.index));

  return content
    .split(FENCED_CODE_PATTERN)
    .map((segment) => {
      if (segment.startsWith("```")) return segment;
      return segment
        .split(INLINE_CODE_PATTERN)
        .map((part) => {
          if (part.startsWith("`") && part.endsWith("`")) return part;
          return part.replace(CITATION_PATTERN, (match, rawIndex) => {
            const index = Number(rawIndex);
            if (!indexSet.has(index)) return match;
            return `[${index}](cite:${index})`;
          });
        })
        .join("");
    })
    .join("");
}
