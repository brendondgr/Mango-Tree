import { resolveModelsUrl } from "@/services/llmEndpoints";
import type { LlmConfig } from "@/services/llmTypes";

interface ModelCard {
  id: string;
  max_model_len?: number;
}

interface ModelsListResponse {
  data?: ModelCard[];
}

function buildHeaders(config: LlmConfig): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (config.apiKey.trim()) {
    headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  }
  return headers;
}

async function fetchModelCards(
  config: LlmConfig,
  signal?: AbortSignal,
): Promise<ModelCard[]> {
  const url = resolveModelsUrl(config.baseUrl);

  const response = await fetch(url, {
    method: "GET",
    headers: buildHeaders(config),
    signal,
  });

  if (!response.ok) {
    throw new Error(
      `Model list request failed (${response.status} ${response.statusText})`,
    );
  }

  const data = (await response.json()) as ModelsListResponse;
  return data.data ?? [];
}

/**
 * List the model ids advertised by the server's GET /v1/models endpoint.
 * Throws when the server is unreachable or responds with an error, so callers
 * (e.g. the settings test-connection flow) can surface the reason.
 */
export async function fetchModelList(
  config: LlmConfig,
  signal?: AbortSignal,
): Promise<string[]> {
  const cards = await fetchModelCards(config, signal);
  return cards
    .map((card) => card.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/** Fetch max context length for the configured model from GET /v1/models. */
export async function fetchModelMaxContext(
  config: LlmConfig,
  signal?: AbortSignal,
): Promise<number | null> {
  let cards: ModelCard[];
  try {
    cards = await fetchModelCards(config, signal);
  } catch {
    return null;
  }

  const modelId = config.model.trim();

  if (modelId) {
    const match = cards.find((card) => card.id === modelId);
    if (match?.max_model_len != null) {
      return match.max_model_len;
    }
  }

  const firstWithLen = cards.find((card) => card.max_model_len != null);
  return firstWithLen?.max_model_len ?? null;
}
