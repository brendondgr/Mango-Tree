import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * Re-exported so existing call sites keep working. The value itself lives in
 * `@/lib/shellGeometry`, alongside the `--breakpoint-app` CSS token it must
 * match; `shellGeometry.test.ts` asserts the two agree.
 */
export { MOBILE_BREAKPOINT } from "@/lib/shellGeometry";
