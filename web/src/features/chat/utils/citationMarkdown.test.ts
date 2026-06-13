import { describe, expect, it } from "vitest";

import {
  buildReferencesByIndex,
  resolveCitationIndex,
} from "@/features/chat/utils/citationMarkdown";

const refs = [
  { index: 1, title: "One", url: "https://one.test" },
  { index: 2, title: "Two", url: "https://two.test" },
];

describe("resolveCitationIndex", () => {
  const byIndex = buildReferencesByIndex(refs);

  it("matches numeric labels to reference URLs", () => {
    expect(resolveCitationIndex("https://one.test", "1", byIndex)).toBe(1);
  });

  it("matches cite protocol links", () => {
    expect(resolveCitationIndex("cite:2", "2", byIndex)).toBe(2);
  });

  it("rejects non-numeric labels", () => {
    expect(resolveCitationIndex("https://one.test", "source", byIndex)).toBeNull();
  });

  it("rejects unknown indices", () => {
    expect(resolveCitationIndex("https://one.test", "9", byIndex)).toBeNull();
  });
});
