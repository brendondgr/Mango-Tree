import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SegmentedControl } from "@/components/app-shell/SegmentedControl";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

afterEach(cleanup);

describe("Field", () => {
  it("associates the label with the control", () => {
    render(
      <Field label="Username">
        <Input />
      </Field>,
    );
    // getByLabelText only resolves when label/control are actually associated.
    expect(screen.getByLabelText("Username")).toBeTruthy();
  });

  it("wires hint and error through aria-describedby", () => {
    render(
      <Field label="Password" hint="At least 12 characters" error="Too short">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText(/Password/);
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    const ids = describedBy.split(" ").filter(Boolean);
    expect(ids).toHaveLength(2);
    const described = ids.map((id) => document.getElementById(id)?.textContent);
    expect(described).toContain("At least 12 characters");
    expect(described).toContain("Too short");
  });

  it("marks an errored control invalid and announces the message", () => {
    render(
      <Field label="Email" error="That address is not valid">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText(/Email/).getAttribute("aria-invalid")).toBe("true");
    // role=alert so the error is announced when it appears rather than only
    // being visible.
    expect(screen.getByRole("alert").textContent).toContain("not valid");
  });

  it("marks a required control without relying on the asterisk alone", () => {
    render(
      <Field label="Name" required>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText(/Name/).getAttribute("aria-required")).toBe("true");
  });

  it("generates distinct ids for repeated fields", () => {
    render(
      <>
        <Field label="First" hint="a">
          <Input />
        </Field>
        <Field label="Second" hint="b">
          <Input />
        </Field>
      </>,
    );
    const first = screen.getByLabelText("First").getAttribute("aria-describedby");
    const second = screen.getByLabelText("Second").getAttribute("aria-describedby");
    expect(first).not.toBe(second);
  });
});

describe("AsyncBoundary", () => {
  it("shows a skeleton and announces the load, not the empty copy", () => {
    render(
      <AsyncBoundary loading empty label="login attempts">
        <p>rows</p>
      </AsyncBoundary>,
    );
    // The bug this guards: panels rendered "No login attempts recorded yet"
    // while the request was still in flight.
    expect(screen.queryByText("Nothing here yet")).toBeNull();
    expect(screen.getByText(/Loading login attempts/)).toBeTruthy();
  });

  it("prefers the error state over loading, and offers a retry", () => {
    const onRetry = vi.fn();
    render(
      <AsyncBoundary
        loading
        error={new Error("network down")}
        label="messages"
        onRetry={onRetry}
      >
        <p>rows</p>
      </AsyncBoundary>,
    );
    expect(screen.getByRole("alert").textContent).toContain("network down");
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows the empty state only once loading has finished", () => {
    render(
      <AsyncBoundary
        loading={false}
        empty
        emptyTitle="No messages"
        emptyDescription="Add an account to start."
      >
        <p>rows</p>
      </AsyncBoundary>,
    );
    expect(screen.getByText("No messages")).toBeTruthy();
    expect(screen.queryByText("rows")).toBeNull();
  });

  it("renders children when loaded and non-empty", () => {
    render(
      <AsyncBoundary loading={false} empty={false}>
        <p>rows</p>
      </AsyncBoundary>,
    );
    expect(screen.getByText("rows")).toBeTruthy();
  });
});

describe("EmptyState", () => {
  it("renders a title, description and action", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Nothing to show yet"
        description="No messages here."
        action={<button type="button">Add account</button>}
      />,
    );
    expect(screen.getByText("Nothing to show yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add account" })).toBeTruthy();
  });
});

describe("SegmentedControl", () => {
  const SEGMENTS = [
    { value: "inbox" as const, label: "Inbox" },
    { value: "sent" as const, label: "Sent" },
    { value: "settings" as const, label: "Settings" },
  ];

  function setup(value: "inbox" | "sent" | "settings" = "inbox") {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        segments={SEGMENTS}
        value={value}
        onValueChange={onValueChange}
        label="Mailbox sections"
      />,
    );
    return { onValueChange };
  }

  it("exposes tablist semantics with a named list", () => {
    setup();
    expect(screen.getByRole("tablist", { name: "Mailbox sections" })).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("uses a roving tabindex so the strip is a single tab stop", () => {
    setup("sent");
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  });

  it("moves between segments with the arrow keys", () => {
    const { onValueChange } = setup("inbox");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenCalledWith("sent");
  });

  it("wraps around at both ends", () => {
    const { onValueChange } = setup("inbox");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });
    expect(onValueChange).toHaveBeenCalledWith("settings");
  });

  it("jumps to the first and last segment with Home and End", () => {
    const { onValueChange } = setup("sent");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "Home" });
    expect(onValueChange).toHaveBeenCalledWith("inbox");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "End" });
    expect(onValueChange).toHaveBeenCalledWith("settings");
  });

  it("selects on click", () => {
    const { onValueChange } = setup();
    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
    expect(onValueChange).toHaveBeenCalledWith("settings");
  });
});
