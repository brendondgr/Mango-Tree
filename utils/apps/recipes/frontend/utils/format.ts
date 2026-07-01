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

const PLACEHOLDER = "https://placehold.co/400x250/e2e8f0/64748b?text=Recipe";

export function primaryImage(images: string[], imageUrl: string | null): string {
  if (images.length > 0 && images[0]) return images[0];
  if (imageUrl) return imageUrl;
  return PLACEHOLDER;
}

export function splitTags(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
