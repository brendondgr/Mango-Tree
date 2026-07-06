import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";

import { ToolGroupsPopover } from "./ToolGroupsPopover";

vi.mock("@/services/toolsClient", () => ({
  fetchToolGroups: vi.fn().mockResolvedValue([]),
}));

const CATALOGUE = [
  { id: "core", label: "Core", tools: ["a", "b", "c", "d", "e", "f"], default_enabled: true },
  { id: "mailbox", label: "Mailbox", tools: ["m1", "m2"], default_enabled: false },
];

afterEach(cleanup);

describe("ToolGroupsPopover", () => {
  it("renders the trigger with a badge for the enabled tool count", () => {
    useWorkspaceStore.getState().setToolGroupCatalogue(CATALOGUE);
    useWorkspaceStore.getState().setEnabledToolGroups(["core"]);

    render(<ToolGroupsPopover />);

    const trigger = screen.getByRole("button", { name: "Tool groups" });
    expect(trigger).toBeTruthy();
    // core contributes 6 tools -> the count badge reads "6".
    expect(trigger.textContent).toContain("6");
  });

  it("disables the trigger when the composer is disabled", () => {
    render(<ToolGroupsPopover disabled />);
    const trigger = screen.getByRole("button", { name: "Tool groups" });
    expect(trigger).toHaveProperty("disabled", true);
  });
});
