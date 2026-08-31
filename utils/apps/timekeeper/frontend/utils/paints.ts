// The flat list of paints the tracker offers, derived from the category
// taxonomy. A "paint" is one subcategory: the grid stores category+subcategory
// ids per block, and the swatch colour comes from the category hue plus the
// subcategory shade.

import type { Category } from "@/types/timekeeper";

import type { Paint } from "@timekeeper/utils/blocks";
import { subcategoryColor } from "@timekeeper/utils/colors";

export interface PaintOption {
  /** Subcategory id — unique across the list. */
  id: string;
  paint: Paint;
  categoryName: string;
  subcategoryName: string;
  /** "Work · Deep focus" — used for the pill, the picker and the cell name. */
  label: string;
  color: string;
}

export function buildPaintOptions(categories: Category[]): PaintOption[] {
  return categories.flatMap((cat) =>
    (cat.subcategories ?? []).map((sub) => ({
      id: sub.id,
      paint: { category_id: cat.id, subcategory_id: sub.id },
      categoryName: cat.name,
      subcategoryName: sub.name,
      label: `${cat.name} · ${sub.name}`,
      color: subcategoryColor(cat.colorId, sub.l),
    })),
  );
}
