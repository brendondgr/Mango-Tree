/**
 * Helpers for mapping a category colour suffix to the corresponding
 * `.projectmanager-cat-<colour>` CSS class (with a safe fallback to "blue"
 * for unknown/null values).
 */

import { CATEGORY_COLORS } from "@/types/projectmanager";

type CategoryColor = (typeof CATEGORY_COLORS)[number];

const VALID = new Set<string>(CATEGORY_COLORS);

function safeColor(color: string | null | undefined): CategoryColor {
  if (color && VALID.has(color)) return color as CategoryColor;
  return "blue";
}

/** Returns the scoped CSS class for a category badge / progress bar. */
export function categoryClass(color: string | null | undefined): string {
  return `projectmanager-cat-${safeColor(color)}`;
}

/** Returns the scoped progress-bar fill class for a category colour. */
export function progressBarClass(color: string | null | undefined): string {
  return `projectmanager-progress-bar-${safeColor(color)}`;
}

/** Returns the scoped timeline-bar class for a category colour. */
export function timelineBarClass(color: string | null | undefined): string {
  return `projectmanager-timeline-bar-${safeColor(color)}`;
}

/**
 * Returns the CSS class for a backend-supplied deadline status
 * (values: "projectmanager-deadline-overdue" | "projectmanager-deadline-warning" |
 * "projectmanager-deadline-normal").  Falls back to normal for unknown values.
 */
export function deadlineClass(cssClass: string | null | undefined): string {
  const known = [
    "projectmanager-deadline-overdue",
    "projectmanager-deadline-warning",
    "projectmanager-deadline-normal",
  ];
  if (cssClass && known.includes(cssClass)) return cssClass;
  return "projectmanager-deadline-normal";
}
