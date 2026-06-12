import { describe, expect, it } from "vitest";

import {
  accentForLanguage,
  labelForLanguage,
  normalizeLanguage,
} from "@/components/markdown/codeBlockAccent";

describe("codeBlockAccent", () => {
  it("normalizes language class names", () => {
    expect(normalizeLanguage("language-python")).toBe("python");
    expect(normalizeLanguage("typescript")).toBe("typescript");
    expect(normalizeLanguage(undefined)).toBe("text");
  });

  it("maps known languages to stable accents", () => {
    expect(accentForLanguage("python")).toBe("mint");
    expect(accentForLanguage("typescript")).toBe("sky");
    expect(accentForLanguage("bash")).toBe("coral");
  });

  it("uses readable labels", () => {
    expect(labelForLanguage("py")).toBe("Python");
    expect(labelForLanguage("tsx")).toBe("TSX");
  });
});
