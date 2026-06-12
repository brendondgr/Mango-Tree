import { useCallback, useEffect, useMemo, useState } from "react";

import {
  getTheme,
  getThemeMeta,
  isDarkTheme,
  setTheme as applyTheme,
  setThemeFamily,
  THEMES,
  toggleThemeInFamily,
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

  const themeMeta = useMemo(() => getThemeMeta(theme), [theme]);
  const isDark = isDarkTheme(theme);
  const pairedThemeId = useMemo(() => toggleThemeInFamily(theme), [theme]);
  const pairedThemeMeta = useMemo(
    () => (pairedThemeId ? getThemeMeta(pairedThemeId) : undefined),
    [pairedThemeId],
  );

  const setTheme = useCallback((name: ThemeName) => {
    applyTheme(name);
    setThemeState(name);
  }, []);

  const setColorScheme = useCallback(
    (colorScheme: "light" | "dark") => {
      const family = themeMeta?.family ?? "mango";
      const next = setThemeFamily(family, colorScheme);
      if (next) {
        setThemeState(next);
      }
    },
    [themeMeta?.family],
  );

  const toggleTheme = useCallback(() => {
    const next = toggleThemeInFamily(theme);
    if ((THEMES as readonly string[]).includes(next)) {
      applyTheme(next as ThemeName);
      setThemeState(next as ThemeName);
    }
  }, [theme]);

  return {
    theme,
    themeMeta,
    isDark,
    pairedThemeMeta,
    setTheme,
    setThemeFamily,
    setColorScheme,
    toggleTheme,
  };
}
