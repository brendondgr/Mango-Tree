// API client for the LLM provider surface, mounted at `/api/llm/`.
// Request/response only — no business logic. Endpoints are documented in
// docs/api.md under "LLM providers".
//
// One rule this module exists to keep: **a key travels in one direction.** It
// may be *sent* in a create/update body; it is never returned by the API, never
// cached here, and never put into an error message or a log line. Everything
// the UI knows about a stored key comes from `key_hint` — a masked tail, enough
// to tell two keys apart while rotating one.
//
// CSRF and the session cookie are added by the global fetch interceptor in
// `@/lib/http`, so nothing here has to think about either.

const UNREACHABLE =
  "Cannot reach the server. Start the backend with `uv run manage.py runserver`.";

const BASE = "/api/llm";

/** Adapter kinds the add/edit form can offer (`GET /api/llm/kinds/`). */
export interface ProviderKind {
  id: string;
  label: string;
  /** Hosted providers authenticate with a key. */
  needs_key: boolean;
  /** Local providers must be told where they live. */
  needs_base_url: boolean;
}

/** A configured endpoint, as the API describes it. Never carries the key. */
export interface LlmProvider {
  slug: string;
  label: string;
  kind: string;
  kind_label: string;
  base_url: string;
  default_model: string;
  params: Record<string, unknown>;
  enabled: boolean;
  connect_timeout: number;
  timeout: number;
  /** "config" rows come from config/models.yaml; "owner" rows from the DB. */
  source: "config" | "owner";
  has_key: boolean;
  needs_key: boolean;
  /** Masked tail of the stored key, or "" when none is set. */
  key_hint: string;
  /** False for config-declared providers: the file is the source of truth. */
  editable: boolean;
}

export interface ProviderListResponse {
  providers: LlmProvider[];
  default_provider: string | null;
}

/**
 * Fields accepted when creating a provider.
 *
 * `api_key` is deliberately optional and write-only: **omitting it leaves a
 * stored key alone, and an explicit empty string clears it.** That asymmetry is
 * the whole reason the UI needs a separate "Remove key" control rather than
 * treating a blank input as "clear".
 */
export interface ProviderWrite {
  slug: string;
  kind: string;
  label?: string;
  base_url?: string;
  default_model?: string;
  api_key?: string;
  api_key_env?: string;
  enabled?: boolean;
  connect_timeout?: number;
  timeout?: number;
}

/** A partial update. The slug identifies the row and cannot be changed. */
export type ProviderPatch = Partial<Omit<ProviderWrite, "slug">>;

export interface DiscoveredModel {
  id: string;
  label: string;
  context_window: number | null;
  max_output_tokens: number | null;
  capabilities: string[];
  /** How each capability was learned: reported, derived, guessed or config. */
  capability_source: string | null;
  family: string | null;
}

/**
 * The result of live discovery.
 *
 * `ok: false` is a **200**, not an error: a local server that is switched off
 * is a normal state the settings page has to render calmly, so the discriminant
 * is in the body rather than in the status code.
 */
export type ModelDiscovery =
  | {
      ok: true;
      provider: string;
      cached: boolean;
      models: DiscoveredModel[];
    }
  | {
      ok: false;
      provider?: string;
      cached?: boolean;
      error: string;
      error_kind?: string;
      models: DiscoveredModel[];
    };

/**
 * The result of `POST /api/llm/test/`.
 *
 * `reachable` and `generated` are separate because listing models proves the
 * endpoint answers, not that the key is accepted for generation — which is the
 * failure that actually bites at send time.
 */
export interface ProviderTestResult {
  provider: string;
  reachable: boolean;
  model_count: number;
  generated: boolean;
  model?: string;
  sample?: string;
  usage?: { input_tokens: number | null; output_tokens: number | null };
  error?: string;
  error_kind?: string;
}

interface ApiErrorBody {
  error?: string;
  detail?: string;
  field?: string;
}

/**
 * Error carrying the backend's machine-readable `kind` and the offending
 * `field`, so a form can attach the message to the input that caused it
 * instead of dumping one red sentence at the bottom.
 */
export class LlmProviderError extends Error {
  kind: string;
  field?: string;
  status: number;

  constructor(message: string, kind: string, status: number, field?: string) {
    super(message);
    this.name = "LlmProviderError";
    this.kind = kind;
    this.status = status;
    this.field = field;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      ...init,
    });
  } catch {
    throw new LlmProviderError(UNREACHABLE, "unreachable", 0);
  }

  if (!response.ok) {
    let body: ApiErrorBody;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }
    throw new LlmProviderError(
      body.detail || body.error || response.statusText || "Request failed",
      body.error || "internal_error",
      response.status,
      body.field,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function listProviderKinds(): Promise<ProviderKind[]> {
  const body = await request<{ kinds: ProviderKind[] }>(`${BASE}/kinds/`);
  return body.kinds ?? [];
}

export function listProviders(): Promise<ProviderListResponse> {
  return request<ProviderListResponse>(`${BASE}/providers/`);
}

export function createProvider(draft: ProviderWrite): Promise<LlmProvider> {
  return request<LlmProvider>(`${BASE}/providers/`, {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export function updateProvider(
  slug: string,
  patch: ProviderPatch,
): Promise<LlmProvider> {
  return request<LlmProvider>(`${BASE}/providers/${encodeURIComponent(slug)}/`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteProvider(slug: string): Promise<void> {
  return request<void>(`${BASE}/providers/${encodeURIComponent(slug)}/`, {
    method: "DELETE",
  });
}

export function discoverModels(
  slug: string,
  options?: { refresh?: boolean },
): Promise<ModelDiscovery> {
  const params = new URLSearchParams({ provider: slug });
  if (options?.refresh) params.set("refresh", "1");
  return request<ModelDiscovery>(`${BASE}/models/?${params.toString()}`);
}

export function testProvider(
  slug: string,
  model?: string,
): Promise<ProviderTestResult> {
  return request<ProviderTestResult>(`${BASE}/test/`, {
    method: "POST",
    body: JSON.stringify(model ? { provider: slug, model } : { provider: slug }),
  });
}
