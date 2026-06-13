import { describe, expect, it } from "vitest";

import { linkifyCitations } from "@/features/chat/utils/linkifyCitations";

const refs = [
  { index: 1, title: "One", url: "https://one.test" },
  { index: 2, title: "Two", url: "https://two.test" },
];

describe("linkifyCitations", () => {
  it("linkifies known citation markers", () => {
    const result = linkifyCitations("Fact [1] and more [2].", refs);
    expect(result).toBe("Fact [1](cite:1) and more [2](cite:2).");
  });

  it("leaves unknown citation markers unchanged", () => {
    const result = linkifyCitations("Unknown [9] marker.", refs);
    expect(result).toBe("Unknown [9] marker.");
  });

  it("does not linkify inside fenced code blocks", () => {
    const result = linkifyCitations("Text [1]\n```\nconst x = [1];\n```", refs);
    expect(result).toContain("Text [1](cite:1)");
    expect(result).toContain("const x = [1];");
    expect(result).not.toContain("cite:1);\n```");
  });

  it("does not linkify inside inline code", () => {
    const result = linkifyCitations("Use `[1]` literal and cite [1].", refs);
    expect(result).toBe("Use `[1]` literal and cite [1](cite:1).");
  });
});
