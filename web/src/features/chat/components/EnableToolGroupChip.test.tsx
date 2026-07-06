import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";

import { EnableToolGroupChip } from "./EnableToolGroupChip";

const CATALOGUE = [
  { id: "core", label: "Core", tools: ["a"], default_enabled: true },
  { id: "mailbox", label: "Mailbox", tools: ["b"], default_enabled: false },
];

beforeEach(() => {
  useWorkspaceStore.getState().setToolGroupCatalogue(CATALOGUE);
  useWorkspaceStore.getState().setEnabledToolGroups(["core"]);
});
afterEach(cleanup);

describe("EnableToolGroupChip", () => {
  it("offers to enable a disabled group and flips the switch on click", () => {
    render(<EnableToolGroupChip group="mailbox" />);
    const button = screen.getByRole("button", { name: /Enable Mailbox/i });
    fireEvent.click(button);
    expect(useWorkspaceStore.getState().enabledToolGroups).toContain("mailbox");
  });

  it("shows an on-state message when the group is already enabled", () => {
    useWorkspaceStore.getState().setEnabledToolGroups(["core", "mailbox"]);
    render(<EnableToolGroupChip group="mailbox" />);
    expect(screen.getByText(/Mailbox tools are on/i)).toBeTruthy();
  });
});
