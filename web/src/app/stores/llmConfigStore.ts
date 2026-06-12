import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { LlmConfig } from "@/services/llmTypes";

export const DEFAULT_LLM_BASE_URL =
  import.meta.env.VITE_LLM_BASE_URL?.trim() || "http://localhost:9090/v1";

export const DEFAULT_LLM_MODEL =
  import.meta.env.VITE_LLM_MODEL?.trim() || "local-model";

export const DEFAULT_LLM_CONFIG: LlmConfig = {
  baseUrl: DEFAULT_LLM_BASE_URL,
  model: DEFAULT_LLM_MODEL,
  apiKey: "",
  maxContextTokens: null,
};

interface LlmConfigState {
  config: LlmConfig;
  setConfig: (config: LlmConfig) => void;
  resetConfig: () => void;
}

export const useLlmConfigStore = create<LlmConfigState>()(
  persist(
    (set) => ({
      config: DEFAULT_LLM_CONFIG,
      setConfig: (config) => set({ config }),
      resetConfig: () => set({ config: DEFAULT_LLM_CONFIG }),
    }),
    {
      name: "mango-llm-config",
    },
  ),
);
