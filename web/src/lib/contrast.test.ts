import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  CONTRAST_AA_NON_TEXT,
  CONTRAST_AA_TEXT,
  contrastBetweenTriplets,
  contrastRatio,
  hexToRgb,
  hslToRgb,
  parseHslTriplet,
  readableForegroundFor,
} from "@/lib/contrast";

const themesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../styles/themes",
);

function themeTokens(file: string): Record<string, string> {
  const css = readFileSync(path.join(themesDir, file), "utf8");
  const tokens: Record<string, string> = {};
  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

const themeFiles = readdirSync(themesDir).filter((f) => f.endsWith(".css"));

describe("contrast maths", () => {
  it("computes the canonical black-on-white ratio", () => {
    const ratio = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(ratio).toBeCloseTo(21, 5);
  });

  it("is symmetric", () => {
    const a = { r: 12, g: 90, b: 200 };
    const b = { r: 240, g: 240, b: 230 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });

  it("parses the theme triplet form", () => {
    expect(parseHslTriplet("271 79% 54%")).toEqual({ h: 271, s: 79, l: 54 });
    expect(parseHslTriplet("0 0% 100%")).toEqual({ h: 0, s: 0, l: 100 });
    expect(parseHslTriplet("linear-gradient(1deg, red, blue)")).toBeNull();
  });

  it("converts HSL to RGB at the reference points", () => {
    expect(hslToRgb({ h: 0, s: 0, l: 100 })).toEqual({ r: 255, g: 255, b: 255 });
    expect(hslToRgb({ h: 0, s: 0, l: 0 })).toEqual({ r: 0, g: 0, b: 0 });
    expect(hslToRgb({ h: 0, s: 100, l: 50 })).toEqual({ r: 255, g: 0, b: 0 });
    expect(hslToRgb({ h: 120, s: 100, l: 50 })).toEqual({ r: 0, g: 255, b: 0 });
    expect(hslToRgb({ h: 240, s: 100, l: 50 })).toEqual({ r: 0, g: 0, b: 255 });
    // Hue wraps rather than clamping.
    expect(hslToRgb({ h: 360, s: 100, l: 50 })).toEqual(
      hslToRgb({ h: 0, s: 100, l: 50 }),
    );
  });

  it("parses both hex forms", () => {
    expect(hexToRgb("#7d2ae8")).toEqual({ r: 125, g: 42, b: 232 });
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("nonsense")).toBeNull();
  });

  it("picks a readable foreground for both light and dark backgrounds", () => {
    for (const bg of [
      { h: 271, s: 79, l: 54 }, // mid purple
      { h: 43, s: 100, l: 85 }, // pale yellow — the case that used to break
      { h: 220, s: 14, l: 13 }, // near-black
      { h: 40, s: 14, l: 96 }, // near-white
    ]) {
      const fg = readableForegroundFor(bg);
      const ratio = contrastRatio(hslToRgb(bg), hslToRgb(fg));
      expect(ratio, `background ${JSON.stringify(bg)}`).toBeGreaterThanOrEqual(
        CONTRAST_AA_TEXT,
      );
    }
  });
});

describe("shipped theme contrast", () => {
  // Pairs that a user reads or relies on. Each entry is
  // [foreground token, background token, minimum ratio, why].
  const PAIRS: Array<[string, string, number, string]> = [
    ["--foreground", "--background", CONTRAST_AA_TEXT, "body text"],
    ["--card-foreground", "--card", CONTRAST_AA_TEXT, "text on cards"],
    ["--popover-foreground", "--popover", CONTRAST_AA_TEXT, "text in overlays"],
    ["--muted-foreground", "--background", CONTRAST_AA_TEXT, "secondary text"],
    ["--primary-foreground", "--primary", CONTRAST_AA_TEXT, "primary button label"],
    [
      "--secondary-foreground",
      "--secondary",
      CONTRAST_AA_TEXT,
      "secondary button label",
    ],
    [
      "--destructive-foreground",
      "--destructive",
      CONTRAST_AA_TEXT,
      "destructive button label",
    ],
    [
      "--primary-emphasis",
      "--card",
      CONTRAST_AA_TEXT,
      "primary-coloured text on a card",
    ],
    [
      "--primary-emphasis",
      "--background",
      CONTRAST_AA_TEXT,
      "primary-coloured text on the page",
    ],
    // 1.4.11: the focus ring is the whole basis of keyboard operability. Two
    // themes used to fail this because --ring was welded to --primary.
    ["--ring", "--background", CONTRAST_AA_NON_TEXT, "focus ring on the page"],
    ["--ring", "--card", CONTRAST_AA_NON_TEXT, "focus ring on a card"],
  ];

  it.each(themeFiles)("%s meets the contrast thresholds", (file) => {
    const tokens = themeTokens(file);
    const failures: string[] = [];

    for (const [fg, bg, minimum, why] of PAIRS) {
      const fgValue = tokens[fg];
      const bgValue = tokens[bg];
      if (!fgValue || !bgValue) continue; // token contract test covers absence
      const ratio = contrastBetweenTriplets(fgValue, bgValue);
      if (ratio === null) continue;
      if (ratio < minimum) {
        failures.push(
          `${why}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${minimum}:1`,
        );
      }
    }

    expect(failures, `${file}\n  ${failures.join("\n  ")}`).toEqual([]);
  });

  it("gives every theme a shadow strong enough to be visible", () => {
    for (const file of themeFiles) {
      const tokens = themeTokens(file);
      const strength = Number((tokens["--shadow-strength"] ?? "").replace("%", ""));
      expect(strength, `${file} --shadow-strength`).toBeGreaterThanOrEqual(5);
      // A dark surface needs a much stronger shadow to read at all; a pure
      // black at 6% over near-black is invisible, which is the bug this guards.
      const background = parseHslTriplet(tokens["--background"] ?? "");
      if (background && background.l < 50) {
        expect(strength, `${file} is a dark theme`).toBeGreaterThanOrEqual(30);
      }
    }
  });
});
