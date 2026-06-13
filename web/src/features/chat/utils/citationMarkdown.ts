import type { ReactNode } from "react";
import { isValidElement as checkValidElement } from "react";

import type { ChatReference } from "@/features/chat/utils/formatReplyMarkdown";

export function getPlainText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(getPlainText).join("");
  if (checkValidElement(children)) {
    const props = children.props as { children?: ReactNode };
    return getPlainText(props.children);
  }
  return "";
}

export function buildReferencesByIndex(
  references: ChatReference[],
): Map<number, ChatReference> {
  return new Map(
    references.map((reference) => [Number(reference.index), reference]),
  );
}

/** Returns citation index when link label is [n] and href matches that source. */
export function resolveCitationIndex(
  href: string | undefined,
  children: ReactNode,
  referencesByIndex: Map<number, ChatReference>,
): number | null {
  const label = getPlainText(children).trim();
  if (!/^\d+$/.test(label)) return null;

  const index = Number(label);
  const reference = referencesByIndex.get(index);
  if (!reference) return null;

  if (href === `cite:${index}` || href === reference.url) {
    return index;
  }

  return null;
}

export function escapeMarkdownLinkUrl(url: string): string {
  return url
    .replace(/ /g, "%20")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29");
}
