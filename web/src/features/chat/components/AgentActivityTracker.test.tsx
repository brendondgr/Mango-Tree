import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";

import { AgentActivityTracker } from "./AgentActivityTracker";

beforeEach(() => {
  useWorkspaceStore.getState().setToolGroupCatalogue([
    { id: "core", label: "Core", tools: ["a"], default_enabled: true },
    { id: "exercise", label: "Exercise", tools: ["b"], default_enabled: false },
    { id: "calendar", label: "Calendar", tools: ["c"], default_enabled: false },
  ]);
});
afterEach(cleanup);

describe("AgentActivityTracker tool selection", () => {
  it("shows which groups the agent chose, why, and what was pinned", () => {
    render(
      <AgentActivityTracker
        thinking=""
        toolSelection={{
          groups: ["core", "calendar", "exercise"],
          pinned: ["core", "calendar"],
          selected: ["exercise"],
          reason: "the user wants to log a run",
          source: "model",
        }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Show/i }));
    const block = screen.getByTestId("tool-selection");
    expect(block.textContent).toContain("Exercise");
    expect(block.textContent).toContain("chosen by Mango");
    expect(block.textContent).toContain("pinned: Calendar");
    expect(block.textContent).toContain("the user wants to log a run");
  });

  it("renders nothing for a manual pass-through with no activity", () => {
    const { container } = render(
      <AgentActivityTracker
        thinking=""
        toolSelection={{ groups: ["core"], pinned: ["core"], selected: [], reason: "manual", source: "manual" }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
