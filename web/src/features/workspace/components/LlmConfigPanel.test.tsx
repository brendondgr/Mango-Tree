import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listProviders: vi.fn(),
  listProviderKinds: vi.fn(),
  discoverModels: vi.fn(),
  testProvider: vi.fn(),
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
  deleteProvider: vi.fn(),
}));

vi.mock("@/services/llmProviders", () => api);

import {
  DEFAULT_LLM_SELECTION,
  LLM_CONFIG_PERSIST_KEY,
  useLlmConfigStore,
} from "@/app/stores/llmConfigStore";

import { LlmConfigPanel } from "./LlmConfigPanel";

// jsdom has no ResizeObserver, which Radix's Select measures its trigger with
// as soon as the provider dialog mounts one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

const CONFIG_PROVIDER = {
  slug: "local",
  label: "Local box",
  kind: "openai_compatible",
  kind_label: "OpenAI-compatible",
  base_url: "http://localhost:9090/v1",
  default_model: "",
  params: {},
  enabled: true,
  connect_timeout: 5,
  timeout: 60,
  source: "config" as const,
  has_key: false,
  needs_key: false,
  key_hint: "",
  editable: false,
};

const OWNER_PROVIDER = {
  slug: "claude",
  label: "Anthropic",
  kind: "anthropic",
  kind_label: "Anthropic",
  base_url: "",
  default_model: "claude-sonnet",
  params: {},
  enabled: true,
  connect_timeout: 5,
  timeout: 60,
  source: "owner" as const,
  has_key: true,
  needs_key: true,
  key_hint: "sk-…f00d",
  editable: true,
};

function model(id: string, contextWindow: number | null = 128000) {
  return {
    id,
    label: id,
    context_window: contextWindow,
    max_output_tokens: null,
    capabilities: ["chat"],
    capability_source: "reported",
    family: null,
  };
}

beforeEach(() => {
  localStorage.clear();
  useLlmConfigStore.getState().resetConfig();
  api.listProviders.mockResolvedValue({
    providers: [CONFIG_PROVIDER, OWNER_PROVIDER],
    default_provider: "local",
  });
  api.listProviderKinds.mockResolvedValue([
    { id: "openai_compatible", label: "OpenAI-compatible", needs_key: false, needs_base_url: true },
    { id: "anthropic", label: "Anthropic", needs_key: true, needs_base_url: false },
  ]);
  api.discoverModels.mockResolvedValue({
    ok: true,
    provider: "local",
    cached: false,
    models: [model("qwen3-30b"), model("gemma-3-12b")],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LlmConfigPanel", () => {
  it("lists providers with their key state and marks config rows read-only", async () => {
    render(<LlmConfigPanel active />);

    expect(await screen.findByText("Local box")).toBeTruthy();
    // "Anthropic" is both a label and a kind, so anchor on the row's radio.
    expect(screen.getByRole("radio", { name: /Anthropic/ })).toBeTruthy();
    // The masked hint stands in for the key, which the API never returns.
    expect(screen.getByText(/sk-…f00d/)).toBeTruthy();
    expect(screen.getByText(/Declared in config\/models\.yaml/)).toBeTruthy();
    // A config provider offers no edit or delete affordance.
    expect(screen.queryByLabelText("Edit Local box")).toBeNull();
    expect(screen.getByLabelText("Edit Anthropic")).toBeTruthy();
  });

  it("never renders a key back into an input", async () => {
    render(<LlmConfigPanel active />);
    await screen.findByLabelText("Edit Anthropic");

    for (const input of Array.from(document.querySelectorAll("input"))) {
      expect(input.value).not.toContain("f00d");
    }
  });

  it("falls back to the first model and says so when the saved one is gone", async () => {
    useLlmConfigStore
      .getState()
      .setSelection({ providerSlug: "local", model: "retired-model" });

    render(<LlmConfigPanel active />);

    expect(await screen.findByText(/The saved model is gone/)).toBeTruthy();
    expect(
      screen.getByText(/"retired-model" is no longer offered by Local box/),
    ).toBeTruthy();
    expect(useLlmConfigStore.getState().selection.model).toBe("qwen3-30b");
  });

  it("shows the discovery error beside the dropdown instead of failing", async () => {
    api.discoverModels.mockResolvedValue({
      ok: false,
      provider: "local",
      cached: false,
      error: "Connection refused",
      models: [],
    });

    render(<LlmConfigPanel active />);

    expect(await screen.findByText(/This provider did not answer/)).toBeTruthy();
    expect(screen.getByText(/Connection refused/)).toBeTruthy();
    // The provider list is still there: an offline endpoint is not a crash.
    expect(screen.getByText("Local box")).toBeTruthy();
    // And the user can still name a model by hand.
    expect(screen.getByLabelText("Model name")).toBeTruthy();
  });

  it("reports reachability and generation as separate outcomes", async () => {
    api.testProvider.mockResolvedValue({
      provider: "local",
      reachable: true,
      model_count: 2,
      generated: false,
      model: "qwen3-30b",
      error: "401 Unauthorized",
    });

    render(<LlmConfigPanel active />);
    fireEvent.click(await screen.findByRole("button", { name: /Test connection/ }));

    expect(await screen.findByText(/Reachable — 2 models listed/)).toBeTruthy();
    expect(screen.getByText("Generation failed")).toBeTruthy();
    expect(screen.getByText(/401 Unauthorized/)).toBeTruthy();
  });

  it("refreshes discovery on demand", async () => {
    render(<LlmConfigPanel active />);
    await screen.findByText("Local box");
    api.discoverModels.mockClear();

    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));

    await waitFor(() =>
      expect(api.discoverModels).toHaveBeenCalledWith("local", { refresh: true }),
    );
  });

  it("leaves a stored key alone when the key field is left blank", async () => {
    api.updateProvider.mockResolvedValue({ ...OWNER_PROVIDER, label: "Claude" });
    render(<LlmConfigPanel active />);

    fireEvent.click(await screen.findByLabelText("Edit Anthropic"));
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "Claude" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.updateProvider).toHaveBeenCalled());
    const [slug, patch] = api.updateProvider.mock.calls[0];
    expect(slug).toBe("claude");
    expect(patch.label).toBe("Claude");
    // Omitted, not "" — the API reads an omitted key as "leave it alone" and an
    // explicit empty string as "clear it".
    expect("api_key" in patch).toBe(false);
  });

  it("clears the key only when Remove key is used", async () => {
    api.updateProvider.mockResolvedValue({ ...OWNER_PROVIDER, has_key: false, key_hint: "" });
    render(<LlmConfigPanel active />);

    fireEvent.click(await screen.findByLabelText("Edit Anthropic"));
    fireEvent.click(await screen.findByRole("button", { name: "Remove key" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.updateProvider).toHaveBeenCalled());
    expect(api.updateProvider.mock.calls[0][1].api_key).toBe("");
  });

  it("switches provider from the list", async () => {
    render(<LlmConfigPanel active />);
    await screen.findByLabelText("Edit Anthropic");

    fireEvent.click(screen.getByRole("radio", { name: /Anthropic/ }));

    await waitFor(() =>
      expect(useLlmConfigStore.getState().selection.providerSlug).toBe("claude"),
    );
  });
});

describe("llmConfigStore persistence", () => {
  it("writes only the provider pointer to localStorage", async () => {
    useLlmConfigStore
      .getState()
      .setSelection({ providerSlug: "claude", model: "claude-sonnet" });
    useLlmConfigStore.getState().setResolved({ endpoint: "https://example.test/v1" });

    await waitFor(() => expect(localStorage.getItem(LLM_CONFIG_PERSIST_KEY)).toBeTruthy());
    const raw = localStorage.getItem(LLM_CONFIG_PERSIST_KEY) ?? "";

    expect(JSON.parse(raw).state).toEqual({
      selection: {
        providerSlug: "claude",
        model: "claude-sonnet",
        // Not secret, and discovery cannot supply it for the many
        // OpenAI-compatible servers that report no context window.
        maxContextTokens: null,
      },
    });
    expect(raw).not.toContain("apiKey");
    expect(raw).not.toContain("baseUrl");
    expect(raw).not.toContain("example.test");
    // The compatibility view stays key-free no matter what.
    expect(useLlmConfigStore.getState().config.apiKey).toBe("");
  });

  it("keeps the model but drops a legacy stored key on rehydrate", async () => {
    localStorage.setItem(
      LLM_CONFIG_PERSIST_KEY,
      JSON.stringify({
        version: 0,
        state: {
          config: {
            baseUrl: "http://localhost:9090/v1",
            model: "qwen3-30b",
            apiKey: "sk-super-secret",
            maxContextTokens: 32000,
          },
        },
      }),
    );

    await useLlmConfigStore.persist.rehydrate();

    expect(useLlmConfigStore.getState().selection).toEqual({
      ...DEFAULT_LLM_SELECTION,
      model: "qwen3-30b",
      // The manual context override survives the migration — it is the user's
      // setting, it is not secret, and nothing else can supply it.
      maxContextTokens: 32000,
    });
    expect(useLlmConfigStore.getState().config.apiKey).toBe("");
    expect(localStorage.getItem(LLM_CONFIG_PERSIST_KEY)).not.toContain("sk-super-secret");
  });

  it("lets a manual context override win over discovery", () => {
    useLlmConfigStore.getState().setSelection({ maxContextTokens: 8192 });
    // Discovery reporting a different number must not silently replace what the
    // owner typed; re-opening the settings panel would otherwise discard it.
    useLlmConfigStore.getState().setResolved({ contextWindow: 128000 });
    expect(useLlmConfigStore.getState().config.maxContextTokens).toBe(8192);

    // With no override, discovery fills the gap.
    useLlmConfigStore.getState().setSelection({ maxContextTokens: null });
    useLlmConfigStore.getState().setResolved({ contextWindow: 128000 });
    expect(useLlmConfigStore.getState().config.maxContextTokens).toBe(128000);
  });

  it("sends the provider slug, not an endpoint, to the agent", () => {
    // The endpoint is display-only. Sending it made the backend take its
    // deprecated inline path, which ignores the owner's server-side key and
    // hardcodes the OpenAI-compatible adapter.
    useLlmConfigStore
      .getState()
      .setSelection({ providerSlug: "anthropic", model: "claude-sonnet-5" });
    expect(useLlmConfigStore.getState().config.providerSlug).toBe("anthropic");
  });
});
