import { beforeEach, describe, expect, it } from "vitest";

import { useWorkspaceStore } from "./workspaceStore";

describe("workspaceStore tool groups", () => {
  beforeEach(() => {
    // Deterministic starting point: default + session both at core only.
    useWorkspaceStore.getState().setDefaultEnabledToolGroups(["core"]);
    useWorkspaceStore.getState().setEnabledToolGroups(["core"]);
    useWorkspaceStore.getState().bindWorkspace(null);
  });

  it("starts with core enabled", () => {
    expect(useWorkspaceStore.getState().enabledToolGroups).toEqual(["core"]);
    expect(useWorkspaceStore.getState().defaultEnabledToolGroups).toEqual(["core"]);
  });

  it("toggles a group on and off (session only)", () => {
    useWorkspaceStore.getState().setToolGroupEnabled("mailbox", true);
    expect(useWorkspaceStore.getState().enabledToolGroups).toContain("mailbox");
    // The persisted default is untouched by a session toggle.
    expect(useWorkspaceStore.getState().defaultEnabledToolGroups).toEqual(["core"]);

    useWorkspaceStore.getState().setToolGroupEnabled("mailbox", false);
    expect(useWorkspaceStore.getState().enabledToolGroups).not.toContain("mailbox");
  });

  it("does not duplicate an already-enabled group", () => {
    useWorkspaceStore.getState().setToolGroupEnabled("core", true);
    expect(
      useWorkspaceStore.getState().enabledToolGroups.filter((g) => g === "core"),
    ).toHaveLength(1);
  });

  it("resets the session to the saved default on new chat", () => {
    useWorkspaceStore.getState().setDefaultEnabledToolGroups(["core", "calendar"]);
    useWorkspaceStore.getState().setToolGroupEnabled("mailbox", true);
    useWorkspaceStore.getState().bindWorkspace("ws-1");

    useWorkspaceStore.getState().startNewChat();

    const state = useWorkspaceStore.getState();
    expect(state.enabledToolGroups).toEqual(["core", "calendar"]);
    expect(state.boundWorkspaceId).toBeNull();
  });

  it("defaults to automatic tool selection and can switch to manual", () => {
    expect(useWorkspaceStore.getState().toolSelectionMode).toBe("auto");
    useWorkspaceStore.getState().setToolSelectionMode("manual");
    expect(useWorkspaceStore.getState().toolSelectionMode).toBe("manual");
    // A new chat keeps the mode: it is a preference, not session state.
    useWorkspaceStore.getState().startNewChat();
    expect(useWorkspaceStore.getState().toolSelectionMode).toBe("manual");
    useWorkspaceStore.getState().setToolSelectionMode("auto");
  });

  it("save-as-default promotes the session set to the persisted default", () => {
    useWorkspaceStore.getState().setEnabledToolGroups(["core", "recipes"]);
    useWorkspaceStore.getState().setDefaultEnabledToolGroups(
      useWorkspaceStore.getState().enabledToolGroups,
    );
    expect(useWorkspaceStore.getState().defaultEnabledToolGroups).toEqual([
      "core",
      "recipes",
    ]);
  });
});
