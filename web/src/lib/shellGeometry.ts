/**
 * Shell geometry — the JS half of the numbers declared in
 * `web/src/styles/globals.css`.
 *
 * These two must agree. Previously the 820px mobile split was re-derived in
 * four places (a `useMediaQuery` constant, a store selector, and two
 * `max-[820px]:` arbitrary variants) and the sidebar's maximum width forgot to
 * subtract the rail, so dragging it fully right left no room for the main
 * panel. Everything now derives from the constants here and the matching
 * `--breakpoint-app` token, and `shellGeometry.test.ts` asserts the two stay in
 * step.
 */

/**
 * The one breakpoint separating the compact shell (bottom navigation, drawer
 * chat, single-pane app bodies) from the expanded one (icon rail, resizable
 * chat sidebar, tab strip).
 *
 * Mirrors `--breakpoint-app` in globals.css. Tailwind's `max-app:` variant
 * compiles to `(max-width: 820.98px)`, so the JS query uses the same bound
 * rather than a rounded-down integer — otherwise a fractional viewport width
 * (which browser zoom produces routinely) can put CSS and JS on opposite sides
 * of the split, and the layout renders half compact and half expanded.
 */
export const APP_BREAKPOINT_PX = 821;

export const MOBILE_BREAKPOINT = `(max-width: ${APP_BREAKPOINT_PX - 0.02}px)`;

/** Width of the desktop icon rail. Mirrors `--rail-w`. */
export const RAIL_WIDTH = 52;

/** Height of the compact bottom navigation. Mirrors `--bottom-nav-h`. */
export const BOTTOM_NAV_HEIGHT = 56;

/** Height of the workspace header. Mirrors `--header-h`. */
export const HEADER_HEIGHT = 48;

/** Chat sidebar sizing. Mirrors `--sidebar-*`. */
export const SIDEBAR_DEFAULT = 360;
export const SIDEBAR_MIN = 280;

/**
 * Narrowest the main panel may become before the sidebar stops growing.
 * Mirrors `--main-min`.
 */
export const MAIN_PANEL_MIN = 320;

/**
 * Largest the chat sidebar may be dragged, given the current window.
 *
 * The rail is subtracted because it sits beside the sidebar and is not part of
 * the space the two panels share — omitting it is what previously let the
 * sidebar squeeze the main panel below its minimum.
 */
export function getSidebarMaxWidth(windowWidth?: number): number {
  const width =
    windowWidth ?? (typeof window === "undefined" ? 1600 : window.innerWidth);
  return Math.max(SIDEBAR_MIN, width - RAIL_WIDTH - MAIN_PANEL_MIN);
}

/**
 * Clamp a requested sidebar width.
 *
 * Zero is preserved as the distinct "collapsed" state; any non-zero width is
 * pulled up to `SIDEBAR_MIN`, so a drag can collapse the sidebar deliberately
 * but can never leave it at an unusable 40px sliver.
 */
export function clampSidebarWidth(width: number, maxWidth?: number): number {
  const max = maxWidth ?? getSidebarMaxWidth();
  if (width <= 0) return 0;
  return Math.max(SIDEBAR_MIN, Math.min(max, width));
}
