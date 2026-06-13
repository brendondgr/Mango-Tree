import { describe, expect, it } from "vitest";

import {
  formatReferencesMarkdown,
  formatReplyMarkdown,
} from "@/features/chat/utils/formatReplyMarkdown";

describe("formatReplyMarkdown", () => {
  const references = [
    { index: 1, title: "Example", url: "https://example.com" },
    { index: 2, title: "Docs", url: "https://docs.example.com" },
  ];

  it("appends a references block when citations are included", () => {
    const markdown = formatReplyMarkdown(
      "Fact from the web [1] and more [2].",
      references,
      { includeCitations: true },
    );

    expect(markdown).toContain("Fact from the web [1]");
    expect(markdown).toContain("## References");
    expect(markdown).toContain("[1] Example — https://example.com");
  });

  it("strips inline citation markers when citations are excluded", () => {
    const markdown = formatReplyMarkdown(
      "Fact from the web [1] and more [2].",
      references,
      { includeCitations: false },
    );

    expect(markdown).toBe("Fact from the web and more.");
    expect(markdown).not.toContain("## References");
  });
});

describe("formatReferencesMarkdown", () => {
  it("returns empty string for no references", () => {
    expect(formatReferencesMarkdown([])).toBe("");
  });
});
