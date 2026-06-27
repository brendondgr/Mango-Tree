// Differentiation helpers: assign stable category accents to accounts and
// senders, and parse sender display names. Chrome stays on theme tokens; only
// these data categories get distinct colors.

export const ACCENTS = ["sky", "mint", "coral", "lavender", "tangerine"] as const;
export type Accent = (typeof ACCENTS)[number];

export function accentClass(accent: Accent): string {
  return `mailbox-c-${accent}`;
}

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Stable accent for any key (account id, sender email). */
export function accentForKey(key: string): Accent {
  return ACCENTS[hash(key) % ACCENTS.length];
}

/** Accent for an account — uses the stored color if valid, else falls back to hash. */
export function accentForAccount(account: { id: string; color?: string | null }): Accent {
  if (account.color && (ACCENTS as readonly string[]).includes(account.color)) {
    return account.color as Accent;
  }
  return accentForKey(account.id);
}

const PROVIDER_LABELS: Record<string, string> = {
  gmail: "Gmail",
  m365: "Microsoft 365",
  exchange: "Exchange",
  yahoo: "Yahoo",
};

export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

export interface ParsedSender {
  name: string;
  email: string;
}

/** "Alice <alice@example.com>" -> {name:"Alice", email:"alice@example.com"} */
export function parseSender(from: string): ParsedSender {
  const match = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const email = match[2].trim();
    return { name: match[1].trim() || email, email };
  }
  const email = (from || "").trim();
  return { name: email || "Unknown", email };
}

