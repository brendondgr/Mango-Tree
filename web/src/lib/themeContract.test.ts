import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { REQUIRED_THEME_CSS_VARS, THEME_META_LIST } from "@/lib/themeMeta";

const themesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../styles/themes",
);

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
