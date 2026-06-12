/** Resolve OpenAI-compatible API paths from a configured base URL. */

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, "");
}

function isDefaultLocalV1(baseUrl: string): boolean {
  const trimmed = normalizeBaseUrl(baseUrl);
  return (
    !trimmed ||
    trimmed === "/v1" ||
    /^https?:\/\/(localhost|127\.0\.0\.1):9090\/v1$/i.test(trimmed)
  );
}

/** Root URL without a trailing /v1 segment. */
export function resolveLlmRootUrl(baseUrl: string): string {
  if (isDefaultLocalV1(baseUrl)) {
    return "";
  }
  const trimmed = normalizeBaseUrl(baseUrl);
  if (trimmed.endsWith("/v1")) {
    return trimmed.slice(0, -3);
  }
  return trimmed;
}

export function resolveChatCompletionsUrl(baseUrl: string): string {
  if (isDefaultLocalV1(baseUrl)) {
    return "/v1/chat/completions";
  }
  return `${normalizeBaseUrl(baseUrl)}/chat/completions`;
}

export function resolveModelsUrl(baseUrl: string): string {
  if (isDefaultLocalV1(baseUrl)) {
    return "/v1/models";
  }
  return `${normalizeBaseUrl(baseUrl)}/models`;
}

export function resolveTokenizeUrl(baseUrl: string): string {
  const root = resolveLlmRootUrl(baseUrl);
  if (!root) {
    return "/tokenize";
  }
  return `${root}/tokenize`;
}
