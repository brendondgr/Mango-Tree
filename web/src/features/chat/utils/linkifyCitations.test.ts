import { describe, expect, it } from "vitest";

import { linkifyCitations } from "@/features/chat/utils/linkifyCitations";

const refs = [
  { index: 1, title: "One", url: "https://one.test/page" },
  { index: 2, title: "Two", url: "https://two.test" },
];

describe("linkifyCitations", () => {
  it("linkifies known citation markers with real source URLs", () => {
    const result = linkifyCitations("Fact [1] and more [2].", refs);
    expect(result).toBe(
      "Fact [1](https://one.test/page) and more [2](https://two.test).",
    );
  });

  it("leaves unknown citation markers unchanged", () => {
    const result = linkifyCitations("Unknown [9] marker.", refs);
    expect(result).toBe("Unknown [9] marker.");
  });

  it("does not linkify inside fenced code blocks", () => {
    const result = linkifyCitations("Text [1]\n```\nconst x = [1];\n```", refs);
    expect(result).toContain("Text [1](https://one.test/page)");
    expect(result).toContain("const x = [1];");
    expect(result).not.toContain("https://one.test/page);\n```");
  });

  it("does not linkify inside inline code", () => {
    const result = linkifyCitations("Use `[1]` literal and cite [1].", refs);
    expect(result).toBe(
      "Use `[1]` literal and cite [1](https://one.test/page).",
    );
  });

  it("escapes parentheses in markdown link URLs", () => {
    const result = linkifyCitations("See [1].", [
      { index: 1, title: "Wiki", url: "https://en.wikipedia.org/wiki Foo_(bar)" },
    ]);
    expect(result).toBe(
      "See [1](https://en.wikipedia.org/wiki%20Foo_%28bar%29).",
    );
  });
});
