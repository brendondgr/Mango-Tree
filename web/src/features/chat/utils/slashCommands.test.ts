import { describe, expect, it } from "vitest";

import type { ToolGroupInfo } from "@/services/toolsClient";

import { getSlashSuggestions, resolveSlashCommand } from "./slashCommands";

const CATALOGUE: ToolGroupInfo[] = [
  { id: "core", label: "Core", tools: ["a"], default_enabled: true },
  { id: "mailbox", label: "Mailbox", tools: ["b"], default_enabled: false },
  { id: "calendar", label: "Calendar", tools: ["c"], default_enabled: false },
];

describe("getSlashSuggestions", () => {
  it("suggests command names on a bare prefix", () => {
    const labels = getSlashSuggestions("/e", CATALOGUE, ["core"]).map((s) => s.label);
    expect(labels).toEqual(["/enable"]);
  });

  it("suggests only disabled groups for /enable", () => {
    const items = getSlashSuggestions("/enable ", CATALOGUE, ["core"]);
    const ids = items.map((s) => s.label);
    expect(ids).toContain("/enable mailbox");
    expect(ids).toContain("/enable calendar");
    expect(ids).not.toContain("/enable core"); // already enabled
  });

  it("suggests only enabled groups for /disable", () => {
    const items = getSlashSuggestions("/disable ", CATALOGUE, ["core", "mailbox"]);
    const ids = items.map((s) => s.label);
    expect(ids).toContain("/disable mailbox");
    expect(ids).toContain("/disable core");
    expect(ids).not.toContain("/disable calendar"); // not enabled
  });

  it("filters group suggestions by partial arg", () => {
    const items = getSlashSuggestions("/enable mail", CATALOGUE, ["core"]);
    expect(items.map((s) => s.label)).toEqual(["/enable mailbox"]);
  });

  it("returns nothing for non-slash text", () => {
    expect(getSlashSuggestions("hello", CATALOGUE, ["core"])).toEqual([]);
  });
});

describe("resolveSlashCommand", () => {
  it("resolves /tools", () => {
    expect(resolveSlashCommand("/tools", CATALOGUE)).toEqual({ kind: "tools" });
  });

  it("resolves /enable <group> against the catalogue", () => {
    expect(resolveSlashCommand("/enable mailbox", CATALOGUE)).toEqual({
      kind: "enable",
      group: "mailbox",
    });
  });

  it("resolves by label too", () => {
    expect(resolveSlashCommand("/disable Calendar", CATALOGUE)).toEqual({
      kind: "disable",
      group: "calendar",
    });
  });

  it("returns null for unknown groups and partial commands", () => {
    expect(resolveSlashCommand("/enable bogus", CATALOGUE)).toBeNull();
    expect(resolveSlashCommand("/enable", CATALOGUE)).toBeNull();
    expect(resolveSlashCommand("hello world", CATALOGUE)).toBeNull();
  });
});
