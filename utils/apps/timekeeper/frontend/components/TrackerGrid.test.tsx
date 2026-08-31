import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TrackerGrid } from "./TrackerGrid";

afterEach(cleanup);

/**
 * The tracker grid is 288 five-minute blocks and it is the whole point of this
 * app, so it has to be operable from the keyboard — and it has to act on the
 * block the user is actually on.
 *
 * It did not. The roving `focusIndex` state was the only source of truth, while
 * the browser's own mousedown focus could move DOM focus somewhere else
 * entirely: clicking a block with no paint selected bailed out *before* the
 * component adopted that cell, so the state stayed at 0 while focus sat on the
 * clicked block. Pressing Delete then erased 00:00 instead of the block under
 * the cursor, and any arrow key jumped back to the top of the day.
 *
 * These tests place DOM focus the way the browser does and assert the grid acts
 * on it, which is what makes them bite: they fail against a version that trusts
 * the state alone.
 */

const BLOCK = 87; // 07:15
const MINUTES_PER_BLOCK = 5;

function setup(overrides: Partial<Parameters<typeof TrackerGrid>[0]> = {}) {
  const onPaintRange = vi.fn();
  const utils = render(
    <TrackerGrid
      describe={(index) => {
        const minutes = index * MINUTES_PER_BLOCK;
        const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
        const mm = String(minutes % 60).padStart(2, "0");
        return `${hh}:${mm}`;
      }}
      colorFor={() => undefined}
      isPainted={() => false}
      mode="paint"
      canPaint
      onPaintRange={onPaintRange}
      {...overrides}
    />,
  );
  const cellAt = (index: number) =>
    utils.container.querySelector<HTMLElement>(`[data-block-index="${index}"]`)!;
  return { ...utils, onPaintRange, cellAt };
}

describe("TrackerGrid keyboard operation", () => {
  it("renders one cell per five-minute block", () => {
    const { container } = setup();
    expect(container.querySelectorAll("[data-block-index]")).toHaveLength(288);
  });

  it("acts on the block that actually has focus, not on a stale index", () => {
    const { cellAt, onPaintRange } = setup({ mode: "erase" });
    // Focus lands here the way a browser's default mousedown focus would,
    // without the component having moved it.
    cellAt(BLOCK).focus();
    fireEvent.keyDown(cellAt(BLOCK), { key: "Delete" });

    expect(onPaintRange).toHaveBeenCalledWith(BLOCK, BLOCK, "erase");
    // The bug erased 00:00 instead.
    expect(onPaintRange).not.toHaveBeenCalledWith(0, 0, "erase");
  });

  it("moves from the focused block, not from the top of the day", () => {
    const { cellAt } = setup();
    cellAt(BLOCK).focus();
    fireEvent.keyDown(cellAt(BLOCK), { key: "ArrowRight" });
    expect(document.activeElement).toBe(cellAt(BLOCK + 1));
  });

  it("paints the focused block with Space", () => {
    const { cellAt, onPaintRange } = setup();
    cellAt(BLOCK).focus();
    fireEvent.keyDown(cellAt(BLOCK), { key: " " });
    expect(onPaintRange).toHaveBeenCalledWith(BLOCK, BLOCK, "paint");
  });

  it("adopts a clicked block even when no paint is selected", () => {
    // The cold-start path: the Tracker opens with nothing selected, so the
    // click correctly paints nothing — but it must still take focus, or the
    // next keystroke edits the wrong block.
    const { cellAt, onPaintRange } = setup({ canPaint: false });
    fireEvent.pointerDown(cellAt(BLOCK), { button: 0, pointerId: 1 });
    expect(onPaintRange).not.toHaveBeenCalled();

    fireEvent.keyDown(cellAt(BLOCK), { key: "Delete" });
    expect(onPaintRange).toHaveBeenCalledWith(BLOCK, BLOCK, "erase");
  });

  it("keeps exactly one cell in the tab order", () => {
    const { container, cellAt } = setup();
    const tabbable = container.querySelectorAll('[data-block-index][tabindex="0"]');
    expect(tabbable).toHaveLength(1);

    cellAt(BLOCK).focus();
    fireEvent.keyDown(cellAt(BLOCK), { key: "ArrowRight" });
    expect(
      container.querySelectorAll('[data-block-index][tabindex="0"]'),
    ).toHaveLength(1);
  });

  it("does not run off either end of the day", () => {
    const { cellAt } = setup();
    cellAt(0).focus();
    fireEvent.keyDown(cellAt(0), { key: "ArrowLeft" });
    expect(document.activeElement).toBe(cellAt(0));

    cellAt(287).focus();
    fireEvent.keyDown(cellAt(287), { key: "ArrowRight" });
    expect(document.activeElement).toBe(cellAt(287));
  });
});
