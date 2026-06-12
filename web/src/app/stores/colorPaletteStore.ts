import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  applyColorOverrides,
  clearColorOverrides,
  type ColorOverrides,
  type ColorToken,
  PRESET_PALETTES,
} from "@/lib/colorPalette";

interface ColorPaletteState {
  activePresetId: string | null;
  overrides: ColorOverrides;
  setTokenColor: (token: ColorToken, hslComponents: string) => void;
  applyPreset: (presetId: string) => void;
  resetPalette: () => void;
}

function syncDom(overrides: ColorOverrides): void {
  clearColorOverrides();
  applyColorOverrides(overrides);
}

export const useColorPaletteStore = create<ColorPaletteState>()(
  persist(
    (set, get) => ({
      activePresetId: null,
      overrides: {},

      setTokenColor: (token, hslComponents) => {
        const overrides = { ...get().overrides, [token]: hslComponents };
        set({ overrides, activePresetId: null });
        syncDom(overrides);
      },

      applyPreset: (presetId) => {
        const preset = PRESET_PALETTES.find((p) => p.id === presetId);
        if (!preset) return;
        const overrides = { ...preset.colors };
        set({ activePresetId: presetId, overrides });
        syncDom(overrides);
      },

      resetPalette: () => {
        set({ activePresetId: null, overrides: {} });
        clearColorOverrides();
      },
    }),
    {
      name: "mango-color-palette",
      onRehydrateStorage: () => (state) => {
        if (state?.overrides && Object.keys(state.overrides).length > 0) {
          syncDom(state.overrides);
        }
      },
    },
  ),
);

/** Call at app boot to restore persisted palette overrides. */
export function initColorPalette(): void {
  const { overrides } = useColorPaletteStore.getState();
  if (Object.keys(overrides).length > 0) {
    syncDom(overrides);
  }
}
