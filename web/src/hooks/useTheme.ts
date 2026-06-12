import { useCallback, useEffect, useState } from "react";

import {
  getTheme,
  setTheme as applyTheme,
  type ThemeName,
} from "@/lib/theme";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeName>(() => getTheme());

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setThemeState(getTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  const setTheme = useCallback((name: ThemeName) => {
    applyTheme(name);
    setThemeState(name);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "default" : "dark");
  }, [setTheme, theme]);

  const isDark = theme === "dark";

  return { theme, isDark, setTheme, toggleTheme };
}
