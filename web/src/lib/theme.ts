/** Runtime theme swapper — persists choice in localStorage. */

export const THEME_STORAGE_KEY = "mango-theme";

/** Register new themes here when adding CSS files under styles/themes/. */
export const THEMES = ["dark", "default"] as const;

export type ThemeName = (typeof THEMES)[number];

export const DEFAULT_THEME: ThemeName = "dark";

function isThemeName(value: string): value is ThemeName {
  return (THEMES as readonly string[]).includes(value);
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
  return name;
}
