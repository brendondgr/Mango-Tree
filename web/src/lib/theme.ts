/** Runtime theme swapper — persists choice in localStorage. */

import { useColorPaletteStore } from "@/app/stores/colorPaletteStore";

import { getThemeMeta, THEME_META_LIST, type ThemeFamily } from "@/lib/themeMeta";

export const THEME_STORAGE_KEY = "mango-theme";

/** Register new themes here when adding CSS files under styles/themes/. */
export const THEMES = [
  "dark",
  "default",
  "blue-light",
  "blue-dark",
  "fsu-light",
  "fsu-dark",
  "pulse-light",
  "pulse-dark",
] as const;

export type ThemeName = (typeof THEMES)[number];

export const DEFAULT_THEME: ThemeName = "dark";

export {
  getThemeMeta,
  getThemeFamily,
  isDarkTheme,
  toggleThemeInFamily,
  THEME_META,
  THEME_META_LIST,
  THEME_GROUPS,
  THEME_FAMILIES,
  THEME_FAMILY_LABELS,
  REQUIRED_THEME_CSS_VARS,
  type ThemeFamily,
  type ThemeMeta,
} from "@/lib/themeMeta";

function isThemeName(value: string): value is ThemeName {
  return (THEMES as readonly string[]).includes(value);
}

function maybeResetPaletteForTheme(name: ThemeName): void {
  const meta = getThemeMeta(name);
  if (meta?.selfContained) {
    useColorPaletteStore.getState().resetPalette();
  }
}

export function getTheme(): ThemeName {
  if (typeof document === "undefined") {
    return DEFAULT_THEME;
  }
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr && isThemeName(attr)) {
    return attr;
  }
  return DEFAULT_THEME;
}

export function setTheme(name: ThemeName): void {
  document.documentElement.setAttribute("data-theme", name);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, name);
  } catch {
    /* private browsing or quota — theme still applies for session */
  }
  maybeResetPaletteForTheme(name);
}

/** Call once at app boot before first paint when possible. */
export function initTheme(): ThemeName {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    stored = null;
  }
  const name = stored && isThemeName(stored) ? stored : DEFAULT_THEME;
  document.documentElement.setAttribute("data-theme", name);
  maybeResetPaletteForTheme(name);
  return name;
}

export function setThemeFamily(
  family: ThemeFamily,
  colorScheme: "light" | "dark",
): ThemeName | null {
  const match = THEME_META_LIST.find(
    (item) => item.family === family && item.colorScheme === colorScheme,
  );
  if (!match || !isThemeName(match.id)) {
    return null;
  }
  setTheme(match.id);
  return match.id;
}
