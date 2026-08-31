import { memo, useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { BLOCKS_PER_DAY, BLOCKS_PER_HOUR, indexToHHMM } from "@timekeeper/utils/blocks";

/**
 * The 288-block day timeline.
 *
 * Before this rewrite the grid was 288 plain `<div>`s: not focusable, not
 * labelled, painted only by `pointerenter` while a mouse button was held, and
 * erasable only with a physical right mouse button. Tab went straight from the
 * date field to the paint pills to Submit, so the app's core feature — logging
 * time — could not be reached from a keyboard at all, and a screen reader
 * announced 288 unlabelled generics.
 *
 * It is now a real grid widget:
 *
 * - `role="grid"` / `row` / `rowheader` / `gridcell`, one cell name per block
 *   giving its time and what is painted there ("07:15, Work · Deep focus").
 * - A roving tabindex: the whole grid is ONE tab stop and arrows move inside
 *   it, rather than 288 stops or none.
 * - Space/Enter applies the current mode, Delete/Backspace always erases, and
 *   Shift with any movement key paints (or erases) the whole range it crosses.
 * - Pointer painting uses pointer capture plus `elementFromPoint`, so a touch
 *   drag paints every block it passes over instead of only the one under the
 *   initial contact. `touch-action: pan-y pinch-zoom` keeps a vertical finger
 *   swipe scrolling the page and a pinch still zooming it, while sideways
 *   gestures stay ours to paint with.
 * - The grid holds no min-width. It used to be `min-w-[26rem]` inside an
 *   `overflow-x: auto` region while claiming every horizontal gesture, so on a
 *   phone-sized pane the last columns of every hour could not be scrolled to,
 *   seen, or painted by touch: there was nowhere to start a horizontal pan.
 *   Columns shrink instead, so all 12 are always reachable.
 */

export type GridMode = "paint" | "erase";

interface TrackerGridProps {
  /** Accessible name for a block, e.g. "07:15, Work · Deep focus". */
  describe: (index: number) => string;
  /** Fill colour for a painted block, or undefined when it is empty. */
  colorFor: (index: number) => string | undefined;
  isPainted: (index: number) => boolean;
  mode: GridMode;
  /** False when no paint is selected — painting no-ops, erasing still works. */
  canPaint: boolean;
  onPaintRange: (from: number, to: number, mode: GridMode) => void;
  /** Id of the visible instructions paragraph, wired as the grid's description. */
  describedBy?: string;
}

function rowStart(index: number): number {
  return index - (index % BLOCKS_PER_HOUR);
}

function clampIndex(index: number): number {
  return Math.max(0, Math.min(BLOCKS_PER_DAY - 1, index));
}

/** The block index of the cell an event landed on, or null if it missed one. */
function cellIndex(target: EventTarget | null): number | null {
  const cell = (target as HTMLElement | null)?.closest?.<HTMLElement>(
    "[data-block-index]",
  );
  if (!cell) return null;
  const index = Number(cell.dataset.blockIndex);
  return Number.isFinite(index) ? index : null;
}

export function TrackerGrid({
  describe,
  colorFor,
  isPainted,
  mode,
  canPaint,
  onPaintRange,
  describedBy,
}: TrackerGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  // The single cell that is in the tab order. Every other cell is tabindex -1.
  const [focusIndex, setFocusIndex] = useState(0);
  // Mirrors focusIndex, but synchronously. The state drives the tabindex
  // attribute and so only lands on a render; a handler firing before that
  // render — a key pressed right after the click that moved focus — must not
  // read a stale index and edit the wrong block.
  const focusIndexRef = useRef(0);
  const dragRef = useRef<{ pointerId: number | null; mode: GridMode; last: number }>({
    pointerId: null,
    mode: "paint",
    last: 0,
  });

  const endDrag = useCallback(() => {
    const drag = dragRef.current;
    if (drag.pointerId === null) return;
    try {
      gridRef.current?.releasePointerCapture?.(drag.pointerId);
    } catch {
      // The pointer may already have been released by the browser.
    }
    drag.pointerId = null;
  }, []);

  // Safety net: a pointer released outside the grid (or over a scrollbar) must
  // still end the drag, or the next hover would keep painting.
  useEffect(() => {
    const stop = () => {
      dragRef.current.pointerId = null;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const rememberFocus = useCallback((index: number) => {
    focusIndexRef.current = index;
    setFocusIndex(index);
  }, []);

  const focusCell = useCallback((index: number, options?: { preventScroll?: boolean }) => {
    rememberFocus(index);
    const cell = gridRef.current?.querySelector<HTMLElement>(
      `[data-block-index="${index}"]`,
    );
    cell?.focus({ preventScroll: options?.preventScroll });
  }, [rememberFocus]);

  const indexFromPoint = useCallback((x: number, y: number): number | null => {
    // Pointer capture routes every move to the grid, so `pointerenter` on the
    // individual cells never fires during a drag — hit-testing the point is
    // what makes drag painting work for touch as well as mouse.
    const element = document.elementFromPoint(x, y);
    const cell = element?.closest<HTMLElement>("[data-block-index]");
    if (!cell || !gridRef.current?.contains(cell)) return null;
    const index = Number(cell.dataset.blockIndex);
    return Number.isFinite(index) ? index : null;
  }, []);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const index = cellIndex(event.target);
    if (index === null) return;

    // The right button still erases, as it always did — but it is no longer the
    // only way to erase.
    const dragMode: GridMode = event.button === 2 ? "erase" : mode;
    // Read before focus moves: shift-click paints from wherever the roving
    // index was, which is the keyboard equivalent of a drag anchor.
    const anchor = focusIndexRef.current;

    event.preventDefault();
    // Focus moves BEFORE the can-paint bail. Bailing first let the browser's
    // own mousedown focus land on the clicked cell while `focusIndex` stayed
    // put, so on a cold tab (no paint selected yet) a click followed by Delete
    // erased 00:00 rather than the block under the pointer.
    focusCell(index, { preventScroll: true });
    if (dragMode === "paint" && !canPaint) return;

    // Capture routes the rest of the gesture here even when the finger leaves
    // the cell it started on. Optional-called because a non-DOM test
    // environment may not implement it.
    gridRef.current?.setPointerCapture?.(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, mode: dragMode, last: index };
    onPaintRange(event.shiftKey ? anchor : index, index, dragMode);
  };

  // Focus this component did not itself move — a click, a programmatic focus,
  // a screen reader stepping through cells — still has to update the roving
  // index, or the keyboard would go on editing the previously focused block.
  // React's onFocus is focusin, so it bubbles from the cell to this container.
  const onFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    const index = cellIndex(event.target);
    if (index !== null) rememberFocus(index);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    const index = indexFromPoint(event.clientX, event.clientY);
    if (index === null || index === drag.last) return;
    // Fill from the previous sample so a fast drag cannot skip blocks.
    onPaintRange(drag.last, index, drag.mode);
    drag.last = index;
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Taken from the cell the key actually landed on, not from state: DOM focus
    // is the truth about which block the user is looking at, and any handler
    // that trusts the roving index instead can be one render behind it.
    const current = cellIndex(event.target) ?? focusIndexRef.current;
    let next = current;

    switch (event.key) {
      case "ArrowRight":
        next = clampIndex(current + 1);
        break;
      case "ArrowLeft":
        next = clampIndex(current - 1);
        break;
      case "ArrowDown":
        next = clampIndex(current + BLOCKS_PER_HOUR);
        break;
      case "ArrowUp":
        next = clampIndex(current - BLOCKS_PER_HOUR);
        break;
      case "Home":
        next = event.ctrlKey ? 0 : rowStart(current);
        break;
      case "End":
        next = event.ctrlKey ? BLOCKS_PER_DAY - 1 : rowStart(current) + BLOCKS_PER_HOUR - 1;
        break;
      case "PageUp":
        next = clampIndex(current - BLOCKS_PER_HOUR * 3);
        break;
      case "PageDown":
        next = clampIndex(current + BLOCKS_PER_HOUR * 3);
        break;
      case " ":
      case "Enter":
        event.preventDefault();
        if (mode === "erase" || canPaint) onPaintRange(current, current, mode);
        return;
      case "Delete":
      case "Backspace":
        event.preventDefault();
        onPaintRange(current, current, "erase");
        return;
      default:
        return;
    }

    event.preventDefault();
    // Shift + movement paints (or erases) everything it crosses, which is the
    // keyboard equivalent of a drag.
    if (event.shiftKey && next !== current && (mode === "erase" || canPaint)) {
      onPaintRange(current, next, mode);
    }
    focusCell(next);
  };

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label="Day timeline in five-minute blocks"
      aria-describedby={describedBy}
      aria-rowcount={24}
      aria-colcount={BLOCKS_PER_HOUR + 1}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onContextMenu={(event) => event.preventDefault()}
      className={cn(
        // No min-width: the columns shrink so every one of the 12 stays
        // reachable on a narrow pane instead of overflowing past the finger.
        "flex select-none flex-col gap-0.5",
        // Only the horizontal axis is ours: a vertical swipe still scrolls the
        // page and a pinch still zooms, both of which a bare `pan-y` killed.
        "touch-pan-y touch-pinch-zoom",
        mode === "erase" ? "cursor-cell" : canPaint ? "cursor-pointer" : "cursor-default",
      )}
    >
      {Array.from({ length: 24 }, (_, hour) => (
        <div
          key={hour}
          role="row"
          aria-rowindex={hour + 1}
          className="grid grid-cols-[3.25rem_repeat(12,minmax(0,1fr))] items-stretch gap-0.5"
        >
          <div
            role="rowheader"
            aria-colindex={1}
            className="flex items-center justify-end pr-1.5 text-xs tabular-nums text-muted-foreground"
          >
            {String(hour).padStart(2, "0")}:00
          </div>
          {Array.from({ length: BLOCKS_PER_HOUR }, (_, column) => {
            const index = hour * BLOCKS_PER_HOUR + column;
            return (
              <BlockCell
                key={index}
                index={index}
                column={column}
                label={describe(index)}
                color={colorFor(index)}
                painted={isPainted(index)}
                tabStop={index === focusIndex}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

const BlockCell = memo(function BlockCell({
  index,
  column,
  label,
  color,
  painted,
  tabStop,
}: {
  index: number;
  column: number;
  label: string;
  color: string | undefined;
  painted: boolean;
  tabStop: boolean;
}) {
  return (
    <div
      role="gridcell"
      aria-colindex={column + 2}
      aria-label={label}
      aria-selected={painted}
      data-block-index={index}
      // Roving tabindex: one stop for the whole grid, arrows move within it.
      tabIndex={tabStop ? 0 : -1}
      title={indexToHHMM(index)}
      className={cn(
        // 28px on a compact pane, 24px once there is room — the floor for a
        // touch target, in a grid that has 288 of them.
        "h-7 rounded-[var(--radius-sm)] border @[44rem]:h-6",
        "motion-safe:transition-colors motion-safe:duration-[var(--motion-duration-xs)]",
        // The outline is drawn inside the cell so the ring is never painted
        // over by the neighbouring block.
        "focus-visible:[outline-offset:-2px]",
        painted
          ? "border-transparent"
          : "border-border/60 bg-surface-2 hover:border-primary/70",
      )}
      style={color ? { background: color } : undefined}
    />
  );
});
