import type { Tiktoken } from "js-tiktoken/lite";

import type { LlmChatMessage } from "@/services/llmTypes";

/**
 * Client-side token estimate, used only when the server's tokenize endpoint is
 * unavailable.
 *
 * The barrel import (`from "js-tiktoken"`) statically pulls **all six** BPE
 * rank tables — gpt2, r50k, p50k, p50k_edit, cl100k and o200k — which measured
 * 5,471 kB minified / 2,504 kB gzipped, roughly 70% of the entire application
 * bundle. Every visitor paid it, including anyone who only ever saw the login
 * page, for a feature that is a fallback for a server call.
 *
 * So: the `lite` core and exactly one rank table are loaded dynamically, and
 * the public function stays synchronous. Until the tables arrive, the estimate
 * falls back to a characters-per-token heuristic — which is honest, because the
 * return value already reports which method produced it and the UI labels it as
 * an estimate either way.
 *
 * A caller that can await should call `ensureTokenizer()` first for the exact
 * count.
 */

type Encoder = Pick<Tiktoken, "encode">;

let encoder: Encoder | null = null;
let loading: Promise<Encoder | null> | null = null;

/**
 * Load the tokenizer, at most once. Resolves to null if it cannot be loaded,
 * in which case the heuristic is used permanently — a failure here must never
 * break the composer.
 */
export function ensureTokenizer(): Promise<Encoder | null> {
  if (encoder) return Promise.resolve(encoder);
  if (loading) return loading;

  loading = (async () => {
    try {
      const [{ Tiktoken }, ranks] = await Promise.all([
        import("js-tiktoken/lite"),
        import("js-tiktoken/ranks/cl100k_base"),
      ]);
      encoder = new Tiktoken(ranks.default);
      return encoder;
    } catch {
      return null;
    }
  })();

  return loading;
}

function serializeMessageContent(content: LlmChatMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .map((part) => (part.type === "text" ? part.text : "[image]"))
    .join("\n");
}

function serializeMessages(messages: LlmChatMessage[]): string {
  return messages
    .map((message) => `${message.role}: ${serializeMessageContent(message.content)}`)
    .join("\n\n");
}

export function estimateMessageTokens(messages: LlmChatMessage[]): {
  count: number;
  method: "tiktoken" | "chars";
} {
  if (messages.length === 0) {
    return { count: 0, method: "tiktoken" };
  }

  const text = serializeMessages(messages);

  if (!encoder) {
    // Warm it for next time, then answer with the heuristic now.
    void ensureTokenizer();
    return { count: Math.ceil(text.length / 4), method: "chars" };
  }

  try {
    return { count: encoder.encode(text).length, method: "tiktoken" };
  } catch {
    return { count: Math.ceil(text.length / 4), method: "chars" };
  }
}
