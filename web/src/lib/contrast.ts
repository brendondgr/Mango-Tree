/**
 * WCAG relative luminance and contrast ratios.
 *
 * Used in two places, and both matter:
 *  - `contrast.test.ts` asserts every shipped theme clears the thresholds, so a
 *    theme edit cannot quietly make body text or a focus ring unreadable.
 *  - `colorPalette.ts` picks a readable foreground for a user-chosen colour
 *    rather than pinning it to white, which is how the palette pickers used to
 *    produce invisible buttons.
 */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** WCAG 2.x minimum contrast ratios. */
export const CONTRAST_AA_TEXT = 4.5;
export const CONTRAST_AA_LARGE_TEXT = 3;
/** 1.4.11 Non-text Contrast — focus indicators, borders, icons. */
export const CONTRAST_AA_NON_TEXT = 3;

/**
 * Parse the `"271 79% 54%"` triplet form the theme files use — HSL components
 * with no `hsl()` wrapper, so they can be composed with an alpha at use sites.
 */
export function parseHslTriplet(value: string): Hsl | null {
  const match = value
    .trim()
    .match(/^(-?[\d.]+)(?:deg)?\s+(-?[\d.]+)%\s+(-?[\d.]+)%$/);
  if (!match) return null;
  return { h: Number(match[1]), s: Number(match[2]), l: Number(match[3]) };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [c, x, 0]
    : hp < 2 ? [x, c, 0]
    : hp < 3 ? [0, c, x]
    : hp < 4 ? [0, x, c]
    : hp < 5 ? [x, 0, c]
    : [c, 0, x];
  const m = lig - c / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export function hexToRgb(hex: string): Rgb | null {
  const value = hex.replace("#", "").trim();
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two colours, from 1 (identical) to 21 (black/white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/** Convenience: contrast between two `"H S% L%"` triplets. */
export function contrastBetweenTriplets(a: string, b: string): number | null {
  const hslA = parseHslTriplet(a);
  const hslB = parseHslTriplet(b);
  if (!hslA || !hslB) return null;
  return contrastRatio(hslToRgb(hslA), hslToRgb(hslB));
}

/**
 * Pick whichever of black or white reads better on `background`.
 *
 * Returned as a theme triplet so it can be assigned straight to a CSS custom
 * property. Near-white rather than pure white, and near-black rather than pure
 * black, because full-range pairs vibrate against saturated colours.
 */
export function readableForegroundFor(background: Hsl): Hsl {
  const bg = hslToRgb(background);
  const onLight: Hsl = { h: background.h, s: 12, l: 8 };
  const onDark: Hsl = { h: background.h, s: 8, l: 98 };
  const lightRatio = contrastRatio(bg, hslToRgb(onLight));
  const darkRatio = contrastRatio(bg, hslToRgb(onDark));
  return lightRatio >= darkRatio ? onLight : onDark;
}

export function formatHslTriplet({ h, s, l }: Hsl): string {
  const round = (n: number) => Math.round(n * 10) / 10;
  return `${round(h)} ${round(s)}% ${round(l)}%`;
}
