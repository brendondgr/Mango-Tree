import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { LlmConfig } from "@/services/llmTypes";

/**
 * What the browser remembers about which model to talk to.
 *
 * It used to remember a base URL and an **API key**, in localStorage, re-sent
 * on every chat turn. That is gone. A key in localStorage is readable by any
 * script that ever runs on the origin and survives long after the user has
 * forgotten it is there; keys now live server-side, and the browser only ever
 * sees a masked `key_hint`.
 *
 * So the persisted state is exactly `{ providerSlug, model }` — a pointer, not a
 * credential. Everything else the server resolves from the provider registry.
 *
 * `config` is a **derived, non-persisted compatibility view** in the older
 * `LlmConfig` shape, because the chat surfaces (`ChatWindow`, `ChatComposer`,
 * `SessionInfoDialog`, `agentRunner`) still read `{ baseUrl, model, apiKey }`
 * and are owned elsewhere. In it:
 *   - `apiKey` is **always** `""` — this store never holds a secret;
 *   - `baseUrl` is the selected provider's endpoint, hydrated at runtime for
 *     display and left empty until then, which the agent route reads as "no
 *     override" and falls back to its own configured provider;
 *   - `maxContextTokens` is the discovered context window, so the context ring
 *     stays accurate now that the browser no longer probes the endpoint itself.
 */
export interface LlmSelection {
  /** Slug of a provider from `GET /api/llm/providers/`. */
  providerSlug: string;
  model: string;
  /**
   * Manual context-window override, for the many OpenAI-compatible servers that
   * report none. Persisted, because discovery cannot supply it and the context
   * ring would otherwise read "limit unknown" after every reload. Not secret.
   */
  maxContextTokens: number | null;
}

export const LLM_CONFIG_PERSIST_KEY = "mango-llm-config";

export const DEFAULT_LLM_SELECTION: LlmSelection = {
  providerSlug: "",
  model: "",
  maxContextTokens: null,
};

/** The compatibility view's zero value. Never carries a key. */
export const DEFAULT_LLM_CONFIG: LlmConfig = {
  providerSlug: "",
  baseUrl: "",
  model: "",
  apiKey: "",
  maxContextTokens: null,
};

/** Details resolved from the provider list / model discovery. Not secret. */
export interface ResolvedProvider {
  endpoint?: string;
  contextWindow?: number | null;
}

interface LlmConfigState {
  /** Persisted. */
  selection: LlmSelection;
  /** Derived compatibility view; `apiKey` is always empty. */
  config: LlmConfig;
  setSelection: (patch: Partial<LlmSelection>) => void;
  setResolved: (resolved: ResolvedProvider) => void;
  resetConfig: () => void;
}

/**
 * Sanitize a selection read back from storage.
 *
 * Only used on rehydrate and migrate, never on keystrokes: trimming while the
 * user types would eat a space mid-word and make the field feel broken.
 */
function normalizeSelection(raw: unknown): LlmSelection {
  const value = (raw ?? {}) as Partial<Record<keyof LlmSelection, unknown>>;
  const raw_max = value.maxContextTokens;
  return {
    providerSlug:
      typeof value.providerSlug === "string" ? value.providerSlug.trim() : "",
    model: typeof value.model === "string" ? value.model.trim() : "",
    maxContextTokens:
      typeof raw_max === "number" && Number.isFinite(raw_max) && raw_max > 0
        ? Math.floor(raw_max)
        : null,
  };
}

export const useLlmConfigStore = create<LlmConfigState>()(
  persist(
    (set) => ({
      selection: DEFAULT_LLM_SELECTION,
      config: DEFAULT_LLM_CONFIG,

      setSelection: (patch) =>
        set((state) => {
          const selection: LlmSelection = {
            providerSlug:
              patch.providerSlug === undefined
                ? state.selection.providerSlug
                : String(patch.providerSlug),
            maxContextTokens:
              patch.maxContextTokens === undefined
                ? state.selection.maxContextTokens
                : patch.maxContextTokens,
            model: patch.model === undefined ? state.selection.model : String(patch.model),
          };
          if (
            selection.maxContextTokens === state.selection.maxContextTokens &&
            selection.providerSlug === state.selection.providerSlug &&
            selection.model === state.selection.model
          ) {
            return state;
          }
          return {
            selection,
            config: {
              ...state.config,
              // The slug is what the agent turn sends; the endpoint is
              // display-only.
              providerSlug: selection.providerSlug,
              model: selection.model,
              maxContextTokens: selection.maxContextTokens,
              apiKey: "",
            },
          };
        }),

      // Both setters bail out when nothing actually changed. `config` is a new
      // object on every write, and the chat composer subscribes to it, so a
      // no-op re-publish would re-render the composer on every settings render.
      setResolved: ({ endpoint, contextWindow }) =>
        set((state) => {
          const baseUrl = endpoint ?? state.config.baseUrl;
          // A manual override always wins. Discovery only fills the gap left by
          // servers that report no context window — otherwise re-opening the
          // settings panel would silently discard the number the owner typed.
          const override = state.selection.maxContextTokens;
          const maxContextTokens =
            override ??
            (contextWindow === undefined ? state.config.maxContextTokens : contextWindow);
          if (
            baseUrl === state.config.baseUrl &&
            maxContextTokens === state.config.maxContextTokens
          ) {
            return state;
          }
          return { config: { ...state.config, baseUrl, maxContextTokens, apiKey: "" } };
        }),

      resetConfig: () =>
        set({ selection: DEFAULT_LLM_SELECTION, config: DEFAULT_LLM_CONFIG }),
    }),
    {
      name: LLM_CONFIG_PERSIST_KEY,
      version: 2,

      // Only the pointer is written to storage. Even if a later refactor put a
      // secret on the state object, it could not reach localStorage from here.
      partialize: (state) => ({ selection: state.selection }),

      // v0/v1 stored `{ config: { baseUrl, model, apiKey, maxContextTokens } }`.
      // Keeping the model is worth it; the rest is dropped, and because a
      // migration forces an immediate rewrite, an already-stored key is erased
      // on the next page load rather than lingering until the user next saves.
      migrate: (persisted, version) => {
        if (version >= 2) {
          return { selection: normalizeSelection((persisted as { selection?: unknown })?.selection) };
        }
        const legacy = (persisted ?? {}) as { config?: unknown };
        const legacyConfig = legacy.config as
          | { model?: unknown; maxContextTokens?: unknown }
          | undefined;
        return {
          selection: normalizeSelection({
            model: legacyConfig?.model,
            maxContextTokens: legacyConfig?.maxContextTokens,
          }),
        };
      },

      // The default shallow merge would restore `selection` but leave the
      // derived `config` at its zero value, so the model would silently reset
      // to "" on every reload.
      merge: (persisted, current) => {
        const selection = normalizeSelection(
          (persisted as { selection?: unknown } | undefined)?.selection,
        );
        return {
          ...current,
          selection,
          config: {
            ...current.config,
            model: selection.model,
            maxContextTokens: selection.maxContextTokens,
            apiKey: "",
          },
        };
      },
    },
  ),
);
