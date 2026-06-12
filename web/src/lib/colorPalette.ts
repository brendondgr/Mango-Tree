/** Runtime color palette helpers — hex/HSL conversion, presets, CSS token overrides. */

export const COLOR_PALETTE_STORAGE_KEY = "mango-color-palette";

/** Accent tokens — preset palettes and brand chrome only. */
export const PRESET_COLOR_TOKENS = ["primary", "accent", "ring"] as const;

/** Surface tokens — controlled by light/dark base theme; optional manual override. */
export const SURFACE_COLOR_TOKENS = [
  "background",
  "foreground",
  "card",
  "muted",
  "secondary",
  "border",
] as const;

/** All editable tokens in the settings UI. */
export const COLOR_TOKENS = [...PRESET_COLOR_TOKENS, ...SURFACE_COLOR_TOKENS] as const;

export type PresetColorToken = (typeof PRESET_COLOR_TOKENS)[number];
export type SurfaceColorToken = (typeof SURFACE_COLOR_TOKENS)[number];
export type ColorToken = (typeof COLOR_TOKENS)[number];

export const COLOR_TOKEN_LABELS: Record<ColorToken, string> = {
  primary: "Primary",
  accent: "Accent",
  ring: "Focus ring",
  background: "Background",
  foreground: "Text",
  card: "Card surface",
  muted: "Muted surface",
  secondary: "Secondary surface",
  border: "Border",
};

export interface PalettePreset {
  id: string;
  name: string;
  description: string;
  swatches: string[];
  colors: Partial<Record<PresetColorToken, string>>;
}

/** Curated palettes — values are HSL components matching theme CSS files. */
export const PRESET_PALETTES: PalettePreset[] = [
  {
    id: "mango",
    name: "Mango",
    description: "Ripe mango gold with leafy green highlights",
    swatches: ["#f5a623", "#ffcc33", "#6bbf3a"],
    colors: {
      primary: "36 91% 55%",
      accent: "88 52% 45%",
      ring: "36 91% 55%",
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Cool blues and teal accents",
    swatches: ["#0ea5e9", "#06b6d4", "#0284c7"],
    colors: {
      primary: "199 89% 48%",
      accent: "187 85% 43%",
      ring: "199 89% 48%",
    },
  },
  {
    id: "forest",
    name: "Forest",
    description: "Earthy greens with lime highlights",
    swatches: ["#16a34a", "#84cc16", "#15803d"],
    colors: {
      primary: "142 71% 36%",
      accent: "84 81% 44%",
      ring: "142 71% 36%",
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm coral and amber tones",
    swatches: ["#f97316", "#ef4444", "#ea580c"],
    colors: {
      primary: "25 95% 53%",
      accent: "0 84% 60%",
      ring: "25 95% 53%",
    },
  },
  {
    id: "lavender",
    name: "Lavender",
    description: "Soft violet accents",
    swatches: ["#a78bfa", "#c4b5fd", "#8b5cf6"],
    colors: {
      primary: "258 90% 66%",
      accent: "252 84% 75%",
      ring: "258 90% 66%",
    },
  },
  {
    id: "slate",
    name: "Slate",
    description: "Neutral grays with blue undertone",
    swatches: ["#64748b", "#94a3b8", "#475569"],
    colors: {
      primary: "215 16% 47%",
      accent: "215 20% 65%",
      ring: "215 16% 47%",
    },
  },
];

export type ColorOverrides = Partial<Record<ColorToken, string>>;

/** Keep only accent overrides — presets must not touch base theme surfaces. */
export function accentOnlyOverrides(overrides: ColorOverrides): ColorOverrides {
  const accent: ColorOverrides = {};
  for (const token of PRESET_COLOR_TOKENS) {
    if (overrides[token]) accent[token] = overrides[token];
  }
  return accent;
}

/** Build accent overrides from a preset (primary, accent, ring only). */
export function applyPresetPalette(preset: PalettePreset): ColorOverrides {
  return accentOnlyOverrides(preset.colors);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Parse #rgb or #rrggbb to normalized channels. */
export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace(/^#/, "");
  if (normalized.length === 3) {
    const r = parseInt(normalized[0]! + normalized[0], 16);
    const g = parseInt(normalized[1]! + normalized[1], 16);
    const b = parseInt(normalized[2]! + normalized[2], 16);
    return { r, g, b };
  }
  if (normalized.length === 6) {
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    if ([r, g, b].some((v) => Number.isNaN(v))) return null;
    return { r, g, b };
  }
  return null;
}

/** Convert hex to shadcn HSL components string, e.g. "271 79% 54%". */
export function hexToHslComponents(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Convert shadcn HSL components to #rrggbb. */
export function hslComponentsToHex(components: string): string | null {
  const match = components.trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!match) return null;

  const h = Number(match[1]);
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (n: number) =>
    clamp(Math.round((n + m) * 255), 0, 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Read a CSS variable's computed HSL components from :root. */
export function readCssToken(token: ColorToken): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim();
  return value;
}

/** Apply custom token overrides on <html>. Pass empty values to remove a token override. */
export function applyColorOverrides(overrides: ColorOverrides): void {
  const root = document.documentElement;
  for (const token of COLOR_TOKENS) {
    const value = overrides[token];
    if (value) {
      root.style.setProperty(`--${token}`, value);
    } else {
      root.style.removeProperty(`--${token}`);
    }
  }
}

/** Remove all runtime color overrides (theme CSS defaults resume). */
export function clearColorOverrides(): void {
  const root = document.documentElement;
  for (const token of COLOR_TOKENS) {
    root.style.removeProperty(`--${token}`);
  }
}

/** Browser EyeDropper when available; returns #rrggbb or null. */
export async function pickColorWithEyedropper(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const EyeDropperCtor = (
    window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }
  ).EyeDropper;

  if (!EyeDropperCtor) return null;

  try {
    const dropper = new EyeDropperCtor();
    const result = await dropper.open();
    return result.sRGBHex;
  } catch {
    return null;
  }
}

export function isEyedropperSupported(): boolean {
  return typeof window !== "undefined" && "EyeDropper" in window;
}
