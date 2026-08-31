import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  APP_BREAKPOINT_PX,
  BOTTOM_NAV_HEIGHT,
  HEADER_HEIGHT,
  MAIN_PANEL_MIN,
  MOBILE_BREAKPOINT,
  RAIL_WIDTH,
  SIDEBAR_DEFAULT,
  SIDEBAR_MIN,
  clampSidebarWidth,
  getSidebarMaxWidth,
} from "@/lib/shellGeometry";

const globalsCss = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../styles/globals.css",
  ),
  "utf8",
);

function cssToken(name: string): string {
  const match = globalsCss.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`${name} not declared in globals.css`);
  return match[1].trim();
}

/** Convert a `rem` or `px` token to pixels at the 16px root default. */
function tokenPx(name: string): number {
  const raw = cssToken(name);
  if (raw.endsWith("rem")) return parseFloat(raw) * 16;
  if (raw.endsWith("px")) return parseFloat(raw);
  throw new Error(`${name} is ${raw}, expected rem or px`);
}

describe("geometry tokens agree between CSS and JS", () => {
  // These pairs drift silently: a change to one produces a layout that is half
  // compact and half expanded, with no error anywhere.
  it.each([
    ["--breakpoint-app", () => APP_BREAKPOINT_PX],
    ["--rail-w", () => RAIL_WIDTH],
    ["--bottom-nav-h", () => BOTTOM_NAV_HEIGHT],
    ["--header-h", () => HEADER_HEIGHT],
    ["--sidebar-default", () => SIDEBAR_DEFAULT],
    ["--sidebar-min", () => SIDEBAR_MIN],
    ["--main-min", () => MAIN_PANEL_MIN],
  ])("%s matches its JS constant", (token, getValue) => {
    expect(tokenPx(token)).toBe(getValue());
  });

  it("derives the media query from the breakpoint token", () => {
    // Tailwind's max-* variant is exclusive by 0.02px; matching it exactly
    // keeps a fractional (zoomed) viewport width on one side of the split.
    expect(MOBILE_BREAKPOINT).toBe(`(max-width: ${APP_BREAKPOINT_PX - 0.02}px)`);
  });
});

describe("getSidebarMaxWidth", () => {
  it("leaves room for both the rail and the main panel", () => {
    expect(getSidebarMaxWidth(1600)).toBe(1600 - RAIL_WIDTH - MAIN_PANEL_MIN);
  });

  it("never returns less than the sidebar minimum", () => {
    // A 400px window cannot satisfy every constraint; the floor keeps the
    // clamp from collapsing to a nonsensical negative maximum.
    expect(getSidebarMaxWidth(400)).toBe(SIDEBAR_MIN);
  });
});

describe("clampSidebarWidth", () => {
  it("keeps zero as the collapsed state", () => {
    expect(clampSidebarWidth(0, 800)).toBe(0);
    expect(clampSidebarWidth(-50, 800)).toBe(0);
  });

  it("pulls any non-zero width up to the minimum", () => {
    // Dragging used to be able to leave a 40px sliver that showed nothing but
    // could not be clicked back open.
    expect(clampSidebarWidth(40, 800)).toBe(SIDEBAR_MIN);
    expect(clampSidebarWidth(SIDEBAR_MIN - 1, 800)).toBe(SIDEBAR_MIN);
  });

  it("caps at the maximum", () => {
    expect(clampSidebarWidth(5000, 800)).toBe(800);
  });

  it("passes a valid width through untouched", () => {
    expect(clampSidebarWidth(SIDEBAR_DEFAULT, 800)).toBe(SIDEBAR_DEFAULT);
  });
});
