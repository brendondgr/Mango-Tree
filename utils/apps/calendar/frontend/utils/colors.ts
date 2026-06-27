// Resolve per-type event colors to hex so blocks can be styled inline.
//
// Merged views return `colors[type]` as Tailwind class names (e.g. bg-purple-100),
// which are not safe to use as dynamic runtime classes. The palette (GET
// /api/calendar/colors/) carries the matching hex values keyed by the same `bg`
// class, so we build a class -> hex map and resolve through it.

import type { ColorMap, PaletteColor } from "@/types/calendar";

export interface EventColor {
  bg: string;
  border: string;
  text: string;
}

const FALLBACK: EventColor = { bg: "#e5e7eb", border: "#9ca3af", text: "#1f2937" };

/** Build a lookup from a Tailwind bg class (e.g. "bg-purple-100") to hex. */
export function buildClassToHex(palette: PaletteColor[]): Map<string, EventColor> {
  const map = new Map<string, EventColor>();
  for (const c of palette) {
    map.set(c.bg, { bg: c.bgHex, border: c.borderHex, text: c.textHex });
  }
  return map;
}

/** Resolve the hex color for an event type given a view's color map + palette. */
export function colorForType(
  type: string,
  viewColors: ColorMap | undefined,
  classToHex: Map<string, EventColor>,
): EventColor {
  const cls = viewColors?.[type];
  if (cls && classToHex.has(cls.bg)) {
    return classToHex.get(cls.bg) as EventColor;
  }
  return FALLBACK;
}
