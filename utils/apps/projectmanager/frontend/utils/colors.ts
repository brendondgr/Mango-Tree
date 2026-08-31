/**
 * Category colour → shared `--category-*` design token.
 *
 * A Category stores one of eight legacy colour names (see `CATEGORY_COLORS`).
 * Those used to resolve to `.projectmanager-cat-<name>` classes backed by
 * hardcoded hex triplets — a light-mode chip that stayed light-mode on the four
 * dark themes, and 24 raw hex literals no theme could reach. Each legacy name
 * now maps onto one of the theme-defined categorical tokens, so a category
 * keeps its identity while tracking whatever theme is active.
 *
 * The token is published as `--pm-accent` on the element rather than written as
 * an inline colour, so utilities (`bg-[hsl(var(--pm-accent))]`) can consume it
 * and every element in a subtree inherits the same accent.
 */

import type { CSSProperties } from "react";

import { CATEGORY_COLORS } from "@/types/projectmanager";

type CategoryColor = (typeof CATEGORY_COLORS)[number];

/** Legacy colour name → categorical palette token. */
const TOKEN: Record<CategoryColor, string> = {
  blue: "sky",
  green: "mint",
  purple: "violet",
  orange: "tangerine",
  red: "crimson",
  teal: "teal",
  yellow: "amber",
  pink: "rose",
};

const VALID = new Set<string>(CATEGORY_COLORS);

/** Narrows an arbitrary backend value to a known colour, defaulting to blue. */
export function safeCategoryColor(
  color: string | null | undefined,
): CategoryColor {
  if (color && VALID.has(color)) return color as CategoryColor;
  return "blue";
}

/** The raw `var(--category-*)` reference for a category colour. */
export function categoryVar(color: string | null | undefined): string {
  return `var(--category-${TOKEN[safeCategoryColor(color)]})`;
}

/** A usable `hsl()` colour, for the rare case a value is needed directly. */
export function categoryHsl(color: string | null | undefined): string {
  return `hsl(${categoryVar(color)})`;
}

/**
 * Style object that publishes the category colour as `--pm-accent`.
 *
 * Spread it onto any element whose subtree should be tinted:
 * `style={categoryAccent(project.category?.color)}`.
 */
export function categoryAccent(
  color: string | null | undefined,
): CSSProperties {
  return { "--pm-accent": categoryVar(color) } as CSSProperties;
}

export type DeadlineTone = "overdue" | "warning" | "normal";

/**
 * Interpret the backend's `deadline_status.css_class`.
 *
 * The API still ships `projectmanager-deadline-*` strings (see
 * `shared/deadline.py`); they are read as a semantic tone here instead of being
 * applied as class names, so the wire format is untouched while the rendering
 * moves onto theme tokens.
 */
export function deadlineTone(
  cssClass: string | null | undefined,
): DeadlineTone {
  if (cssClass === "projectmanager-deadline-overdue") return "overdue";
  if (cssClass === "projectmanager-deadline-warning") return "warning";
  return "normal";
}
