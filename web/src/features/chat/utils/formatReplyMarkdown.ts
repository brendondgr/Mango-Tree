export interface ChatReference {
  index: number;
  title: string;
  url: string;
}

export function formatReferencesMarkdown(
  references: ChatReference[],
): string {
  if (references.length === 0) return "";

  const lines = references.map(
    (ref) => `[${ref.index}] ${ref.title} — ${ref.url}`,
  );
  return `## References\n\n${lines.join("\n")}`;
}

export function formatReplyMarkdown(
  content: string,
  references: ChatReference[] | undefined,
  options: { includeCitations: boolean },
): string {
  let body = content.trim();

  if (!options.includeCitations) {
    body = body.replace(/\s*\[\d+\]/g, "");
    body = body.replace(/[ \t]{2,}/g, " ").trim();
    return body;
  }

  const refsBlock = formatReferencesMarkdown(references ?? []);
  if (!refsBlock) return body;
  return `${body}\n\n${refsBlock}`;
}
