import type { ChatReference } from "@/features/chat/utils/formatReplyMarkdown";
import { escapeMarkdownLinkUrl } from "@/features/chat/utils/citationMarkdown";

const CITATION_PATTERN = /\[(\d+)\]/g;
const FENCED_CODE_PATTERN = /(```[\s\S]*?```)/g;
const INLINE_CODE_PATTERN = /(`[^`\n]+`)/g;

function referenceUrlByIndex(
  references: ChatReference[],
): Map<number, string> {
  return new Map(
    references.map((reference) => [Number(reference.index), reference.url]),
  );
}

/**
 * Turns inline [n] citation markers into markdown links using real source URLs.
 * MarkdownContent renders numeric source links as circular CitationBadge components.
 */
export function linkifyCitations(
  content: string,
  references: ChatReference[],
): string {
  if (references.length === 0) return content;

  const urlByIndex = referenceUrlByIndex(references);

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
            const url = urlByIndex.get(index);
            if (!url) return match;
            return `[${index}](${escapeMarkdownLinkUrl(url)})`;
          });
        })
        .join("");
    })
    .join("");
}
