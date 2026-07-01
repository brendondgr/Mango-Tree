// Category colours are DATA colours (per the theme preference, chrome uses theme
// tokens; only data categories get distinct hues). A category carries a colorId
// (green/blue/red/…) that fixes a hue+saturation; each subcategory carries a
// shade level `l` (0..100) used as HSL lightness so shades of one category stay
// visually related.

import type { Category, Subcategory } from "@/types/timekeeper";

interface Hue {
  h: number;
  s: number;
}

// hue + saturation per colorId. Lightness comes from the subcategory shade.
const HUES: Record<string, Hue> = {
  green: { h: 152, s: 60 },
  blue: { h: 212, s: 70 },
  purple: { h: 270, s: 62 },
  red: { h: 0, s: 68 },
  orange: { h: 28, s: 80 },
  teal: { h: 174, s: 58 },
  yellow: { h: 45, s: 80 },
  pink: { h: 330, s: 70 },
};

export const COLOR_IDS = Object.keys(HUES);
const FALLBACK: Hue = { h: 220, s: 10 };

function hue(colorId: string | undefined): Hue {
  return (colorId && HUES[colorId]) || FALLBACK;
}

/** The base swatch for a category (a mid lightness of its hue). */
export function categoryColor(colorId: string | undefined): string {
  const { h, s } = hue(colorId);
  return `hsl(${h} ${s}% 45%)`;
}

/** Clamp a subcategory shade level to a usable HSL lightness band. */
function shadeLightness(l: number | undefined): number {
  const level = typeof l === "number" ? l : 50;
  // Map 0..100 to a 30%..70% lightness band so nothing is pure black/white.
  return 30 + Math.max(0, Math.min(100, level)) * 0.4;
}

/** The fill colour for a painted block of this subcategory. */
export function subcategoryColor(colorId: string | undefined, l: number | undefined): string {
  const { h, s } = hue(colorId);
  return `hsl(${h} ${s}% ${shadeLightness(l)}%)`;
}

/** Readable text colour (black/white) for a given shade level. */
export function shadeText(l: number | undefined): string {
  return shadeLightness(l) > 55 ? "#111827" : "#f9fafb";
}

// --- lookup helpers ----------------------------------------------------------

export interface Resolved {
  categoryName: string;
  subcategoryName: string;
  color: string;
  colorId: string;
}

/** Build id -> {names, colour} maps so logs can be rendered by their ids. */
export function buildResolver(categories: Category[]) {
  const byCat = new Map<string, Category>();
  const bySub = new Map<string, { cat: Category; sub: Subcategory }>();
  for (const cat of categories) {
    byCat.set(cat.id, cat);
    for (const sub of cat.subcategories ?? []) {
      bySub.set(sub.id, { cat, sub });
    }
  }

  function resolve(categoryId: string | null, subcategoryId: string | null): Resolved {
    const subEntry = subcategoryId ? bySub.get(subcategoryId) : undefined;
    if (subEntry) {
      return {
        categoryName: subEntry.cat.name,
        subcategoryName: subEntry.sub.name,
        color: subcategoryColor(subEntry.cat.colorId, subEntry.sub.l),
        colorId: subEntry.cat.colorId,
      };
    }
    const cat = categoryId ? byCat.get(categoryId) : undefined;
    if (cat) {
      return {
        categoryName: cat.name,
        subcategoryName: "",
        color: categoryColor(cat.colorId),
        colorId: cat.colorId,
      };
    }
    return { categoryName: "Untracked", subcategoryName: "", color: "hsl(220 8% 60%)", colorId: "" };
  }

  return { resolve, byCat, bySub };
}
