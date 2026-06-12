import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useTheme } from "@/hooks/useTheme";
import { THEMES } from "@/lib/theme";
import { isDarkTheme, toggleThemeInFamily } from "@/lib/themeMeta";

describe("useTheme", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  it("reflects isDark from theme metadata for every registered theme", () => {
    for (const themeId of THEMES) {
      act(() => {
        document.documentElement.setAttribute("data-theme", themeId);
      });
      const { result } = renderHook(() => useTheme());
      expect(result.current.isDark).toBe(isDarkTheme(themeId));
    }
  });

  it("toggles within the active family", () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current.setTheme("fsu-dark");
    });
    expect(result.current.theme).toBe("fsu-dark");
    expect(result.current.isDark).toBe(true);

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe("fsu-light");
    expect(result.current.pairedThemeMeta?.label).toBe("FSU Dark");
  });

  it("exposes paired theme metadata", () => {
    act(() => {
      document.documentElement.setAttribute("data-theme", "pulse-light");
    });
    const { result } = renderHook(() => useTheme());
    expect(result.current.pairedThemeMeta?.id).toBe(
      toggleThemeInFamily("pulse-light"),
    );
  });
});
