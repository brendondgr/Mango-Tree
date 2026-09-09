import { describe, expect, it } from "vitest";

import { getSlashSuggestions, resolveSlashCommand } from "./slashCommands";

describe("slash commands: selection mode", () => {
  it("resolves /auto and /manual", () => {
    expect(resolveSlashCommand("/auto", [])).toEqual({ kind: "mode", mode: "auto" });
    expect(resolveSlashCommand("/manual", [])).toEqual({ kind: "mode", mode: "manual" });
  });

  it("suggests them from a partial", () => {
    const labels = getSlashSuggestions("/a", [], []).map((s) => s.label);
    expect(labels).toEqual(["/auto"]);
  });
});
