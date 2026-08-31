// Resolve per-type event colors to THEME tokens.
//
// The API palette (GET /api/calendar/colors/) is a fixed list of 16 named
// colors carrying Tailwind class names plus baked hex values. Those hexes were
// authored for one light theme: rendered on the dark themes they produce pale
// pastel blocks with unreadable text, and they ignore the shared
// `--category-*` scale every other app module now uses.
//
// So the hex is dropped and the palette NAME is what travels: each name binds
// a `--c` custom property to a `--category-*` token, and CSS derives the fill,
// the rail and the text from it. Merged views still return `colors[type]` as
// Tailwind class names (e.g. `bg-purple-100`) which are unsafe as dynamic
// runtime classes, so the palette's `bg` class remains the join key between a
// view's color map and the palette entry.

import type { CSSProperties } from "react";

import type { ColorMap, PaletteColor } from "@/types/calendar";

/** A category color bound to a theme token rather than a fixed hex. */
export interface CategoryColor {
  /** The palette name the API stores, or the event type when unmapped. */
  name: string;
  /** Human-readable hue label — what the swatch actually looks like. */
  label: string;
  /** Value for the `--c` custom property: an HSL triplet token reference. */
  value: string;
}

/** The 15 shared categorical tokens, in a deliberately non-adjacent order. */
const CATEGORY_TOKENS: Array<[label: string, token: string]> = [
  ["Sky", "sky"],
  ["Coral", "coral"],
  ["Mint", "mint"],
  ["Lavender", "lavender"],
  ["Tangerine", "tangerine"],
  ["Teal", "teal"],
  ["Rose", "rose"],
  ["Lime", "lime"],
  ["Violet", "violet"],
  ["Amber", "amber"],
  ["Indigo", "indigo"],
  ["Peach", "peach"],
  ["Sage", "sage"],
  ["Crimson", "crimson"],
  ["Slate", "slate"],
];

function token(name: string, label: string, cssToken: string): CategoryColor {
  return { name, label, value: `var(${cssToken})` };
}

/**
 * API palette name -> theme token. The labels are the token's hue, not the
 * API's name, because the swatch must be honest about the color it paints:
 * the stored name is an opaque server identifier, `label` is what the user
 * sees. "black" has no categorical hue, so it takes the strongest neutral the
 * theme has, which reads as ink on light themes and chalk on dark ones.
 */
const BY_PALETTE_NAME: Record<string, CategoryColor> = {
  "yellow-orange": token("yellow-orange", "Tangerine", "--category-tangerine"),
  yellow: token("yellow", "Amber", "--category-amber"),
  orange: token("orange", "Peach", "--category-peach"),
  red: token("red", "Crimson", "--category-crimson"),
  blue: token("blue", "Sky", "--category-sky"),
  purple: token("purple", "Violet", "--category-violet"),
  teal: token("teal", "Teal", "--category-teal"),
  "light-purple": token("light-purple", "Lavender", "--category-lavender"),
  "light-blue": token("light-blue", "Indigo", "--category-indigo"),
  green: token("green", "Mint", "--category-mint"),
  black: token("black", "Ink", "--foreground"),
  "muted-gray": token("muted-gray", "Slate", "--category-slate"),
  brown: token("brown", "Sage", "--category-sage"),
  "light-pink": token("light-pink", "Coral", "--category-coral"),
  kiwi: token("kiwi", "Lime", "--category-lime"),
  rose: token("rose", "Rose", "--category-rose"),
};

/** Stable, order-independent hash so a type keeps its color between renders. */
function hashKey(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Color for a type the palette says nothing about. Previously every such type
 * fell back to the same grey, so an unmapped schedule rendered as one
 * undifferentiated block; hashing keeps them distinguishable and stable.
 */
export function categoryForKey(key: string): CategoryColor {
  const [label, cssToken] = CATEGORY_TOKENS[hashKey(key) % CATEGORY_TOKENS.length];
  return token(key, label, `--category-${cssToken}`);
}

/** The palette entry for a stored color name, if it is one we know. */
export function categoryForName(name: string): CategoryColor | undefined {
  return BY_PALETTE_NAME[name];
}

/** Build a lookup from a Tailwind bg class (e.g. "bg-purple-100") to a token. */
export function buildColorIndex(palette: PaletteColor[]): Map<string, CategoryColor> {
  const map = new Map<string, CategoryColor>();
  for (const entry of palette) {
    const color = BY_PALETTE_NAME[entry.name] ?? categoryForKey(entry.name);
    map.set(entry.bg, color);
  }
  return map;
}

/** Resolve the token for an event type given a view's color map + palette. */
export function colorForType(
  type: string,
  viewColors: ColorMap | undefined,
  index: Map<string, CategoryColor>,
): CategoryColor {
  const cls = viewColors?.[type];
  const mapped = cls ? index.get(cls.bg) : undefined;
  return mapped ?? categoryForKey(type);
}

/** Inline style that binds `--c` for the CSS in styles/calendar.css to read. */
export function categoryStyle(
  color: CategoryColor,
  extra?: Record<string, string | number>,
): CSSProperties {
  return { "--c": color.value, ...extra } as CSSProperties;
}
