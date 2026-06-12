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

/** Fetch max context length for the configured model from GET /v1/models. */
export async function fetchModelMaxContext(
  config: LlmConfig,
  signal?: AbortSignal,
): Promise<number | null> {
  const url = resolveModelsUrl(config.baseUrl);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(config),
      signal,
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let data: ModelsListResponse;
  try {
    data = (await response.json()) as ModelsListResponse;
  } catch {
    return null;
  }

  const modelId = config.model.trim();
  const cards = data.data ?? [];

  if (modelId) {
    const match = cards.find((card) => card.id === modelId);
    if (match?.max_model_len != null) {
      return match.max_model_len;
    }
  }

  const firstWithLen = cards.find((card) => card.max_model_len != null);
  return firstWithLen?.max_model_len ?? null;
}
