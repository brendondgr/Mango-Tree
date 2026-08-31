import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { REQUIRED_THEME_CSS_VARS, THEME_META_LIST } from "@/lib/themeMeta";

const stylesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../styles",
);
const themesDir = path.join(stylesDir, "themes");
const appsDir = path.resolve(stylesDir, "../../../utils/apps");

function extractCssVars(css: string): Set<string> {
  const vars = new Set<string>();
  const matches = css.matchAll(/(--[a-z0-9-]+)\s*:/gi);
  for (const match of matches) {
    vars.add(match[1]);
  }
  return vars;
}

describe("theme CSS contract", () => {
  it("has a CSS file for every registered theme id", () => {
    const files = readdirSync(themesDir);
    for (const meta of THEME_META_LIST) {
      const expected =
        meta.id === "default" ? "default.css" : `${meta.id}.css`;
      expect(files).toContain(expected);
    }
  });

  it("defines required variables in every theme file", () => {
    const files = readdirSync(themesDir).filter((file) => file.endsWith(".css"));

    for (const file of files) {
      const css = readFileSync(path.join(themesDir, file), "utf8");
      const defined = extractCssVars(css);
      for (const token of REQUIRED_THEME_CSS_VARS) {
        expect(defined.has(token), `${file} missing ${token}`).toBe(true);
      }
    }
  });
});

describe("Tailwind @source registration", () => {
  // App modules live outside the Vite root, so Tailwind's automatic content
  // detection never sees them. A missing @source entry does not fail
  // typecheck, tests, or the build — it silently drops that module's utility
  // classes from the production CSS, and only shows up as an unstyled panel
  // after a deploy. projectmanager was missing for exactly this reason.
  it("registers every app frontend that uses utility classes", () => {
    const globals = readFileSync(path.join(stylesDir, "globals.css"), "utf8");
    const registered = new Set(
      [...globals.matchAll(/@source\s+"[^"]*utils\/apps\/([^/"]+)\/frontend"/g)].map(
        (match) => match[1],
      ),
    );

    const appsWithFrontends = readdirSync(appsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => existsSync(path.join(appsDir, name, "frontend")));

    expect(appsWithFrontends.length).toBeGreaterThan(0);
    for (const app of appsWithFrontends) {
      expect(
        registered.has(app),
        `utils/apps/${app}/frontend is not registered with @source in ` +
          `web/src/styles/globals.css — its utility classes will be dropped ` +
          `from the production CSS`,
      ).toBe(true);
    }
  });
});
