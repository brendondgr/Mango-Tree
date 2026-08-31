// Small presentation helpers for the recipes UI.

export function formatQuantity(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

/**
 * Scale a base ingredient quantity from the recipe's original serving count to a
 * user-chosen count. Returns null when the ingredient has no numeric quantity.
 */
export function scaleQuantity(base: number | null, from: number, to: number): string | null {
  if (base == null) return null;
  if (!from || from <= 0) return formatQuantity(base);
  return formatQuantity(base * (to / from));
}

/**
 * The recipe's own image, or `null` when it has none.
 *
 * This used to hand back a placehold.co URL with two hardcoded slate hex values
 * in it. Callers now render a themed placeholder (see `RecipeImage`) instead of
 * loading a fixed-colour image from a third-party host.
 */
export function primaryImage(images: string[], imageUrl: string | null): string | null {
  if (images.length > 0 && images[0]) return images[0];
  if (imageUrl) return imageUrl;
  return null;
}

export function splitTags(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
