/**
 * Categorical accent colour for a recipe.
 *
 * Recipes without a photo used to fall back to a placehold.co image baked with
 * two fixed slate hex values, so every image-less card rendered the same
 * washed-out grey no matter which of the eight themes was active — and drawing
 * it needed a third-party host. A recipe now picks one of the theme's
 * `--category-*` hues, deterministically from its cuisine (falling back to its
 * title), so the same cuisine always reads in the same colour and the tint
 * follows the theme instead of fighting it.
 */

const ACCENT_TOKENS = [
  "coral",
  "tangerine",
  "mint",
  "sky",
  "lavender",
  "rose",
  "violet",
  "teal",
  "amber",
  "lime",
  "indigo",
  "peach",
  "sage",
  "crimson",
  "slate",
] as const;

export type AccentToken = (typeof ACCENT_TOKENS)[number];

/** Stable, order-independent pick from the categorical palette. */
export function accentToken(seed: string): AccentToken {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (Math.imul(hash, 31) + seed.charCodeAt(i)) >>> 0;
  }
  return ACCENT_TOKENS[hash % ACCENT_TOKENS.length];
}

/**
 * An `hsl()` expression for a recipe's accent, for a `style` prop.
 *
 * Written as a token reference rather than a literal colour so it resolves
 * against whichever theme is mounted; `alpha` below 1 gives the soft tint used
 * behind placeholder art.
 */
export function accentColor(seed: string, alpha = 1): string {
  return `hsl(var(--category-${accentToken(seed)}) / ${alpha})`;
}
