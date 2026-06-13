import { create } from "zustand";

interface ComposerWebSearchState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}

export const useComposerWebSearchStore = create<ComposerWebSearchState>((set) => ({
  enabled: false,
  setEnabled: (enabled) => set({ enabled }),
  toggle: () => set((state) => ({ enabled: !state.enabled })),
}));
