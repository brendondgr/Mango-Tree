import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_THEME,
  getTheme,
  initTheme,
  setTheme,
  setThemeFamily,
  THEME_STORAGE_KEY,
  THEMES,
} from "@/lib/theme";
import {
  getPairedThemeId,
  isDarkTheme,
  toggleThemeInFamily,
} from "@/lib/themeMeta";

describe("theme registry", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers all eight compound theme ids", () => {
    expect(THEMES).toHaveLength(8);
    expect(THEMES).toContain("default");
    expect(THEMES).toContain("fsu-dark");
    expect(THEMES).toContain("pulse-light");
  });

  it("persists and restores theme choice", () => {
    setTheme("fsu-light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("fsu-light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("fsu-light");
    expect(getTheme()).toBe("fsu-light");
  });

  it("falls back to default theme for invalid stored values", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "not-a-theme");
    const theme = initTheme();
    expect(theme).toBe(DEFAULT_THEME);
    expect(document.documentElement.getAttribute("data-theme")).toBe(DEFAULT_THEME);
  });

  it("pairs light and dark variants within the same family", () => {
    expect(toggleThemeInFamily("fsu-dark")).toBe("fsu-light");
    expect(toggleThemeInFamily("fsu-light")).toBe("fsu-dark");
    expect(toggleThemeInFamily("pulse-dark")).toBe("pulse-light");
    expect(toggleThemeInFamily("default")).toBe("dark");
    expect(toggleThemeInFamily("dark")).toBe("default");
  });

  it("selects themes by family and color scheme", () => {
    const selected = setThemeFamily("blue", "light");
    expect(selected).toBe("blue-light");
    expect(getTheme()).toBe("blue-light");
  });

  it("reports dark mode from metadata", () => {
    expect(isDarkTheme("dark")).toBe(true);
    expect(isDarkTheme("blue-light")).toBe(false);
    expect(getPairedThemeId("pulse-dark")).toBe("pulse-light");
  });
});
