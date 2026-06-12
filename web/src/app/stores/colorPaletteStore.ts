import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  applyColorOverrides,
  applyPresetPalette,
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

/** Presets affect accent tokens only; surfaces always come from the base theme. */
function resolveOverrides(
  activePresetId: string | null,
  overrides: ColorOverrides,
): ColorOverrides {
  if (activePresetId) {
    const preset = PRESET_PALETTES.find((p) => p.id === activePresetId);
    if (preset) return applyPresetPalette(preset);
  }
  return overrides;
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
        const overrides = applyPresetPalette(preset);
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
        if (!state) return;
        const overrides = resolveOverrides(state.activePresetId, state.overrides);
        state.overrides = overrides;
        if (Object.keys(overrides).length > 0) {
          syncDom(overrides);
        } else {
          clearColorOverrides();
        }
      },
    },
  ),
);

/** Call at app boot to restore persisted palette overrides. */
export function initColorPalette(): void {
  const { activePresetId, overrides } = useColorPaletteStore.getState();
  const resolved = resolveOverrides(activePresetId, overrides);
  if (resolved !== overrides) {
    useColorPaletteStore.setState({ overrides: resolved });
  }
  if (Object.keys(resolved).length > 0) {
    syncDom(resolved);
  }
}
