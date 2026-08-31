import { ChevronLeft } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * List beside detail on a wide pane; list *or* detail on a narrow one.
 *
 * This single pattern fixes the same failure in four app modules. Mailbox,
 * projects, recipes and the calendar schedule view each put a fixed-width list
 * or filter column next to a content area, inside a pane whose ancestor is
 * `overflow-hidden`. On a phone the fixed column consumed most of the width and
 * the content beside it was clipped rather than scrolled — unreachable by any
 * gesture. Each app had invented its own partial answer.
 *
 * Sizing is driven by a **container query**, not the viewport, because these
 * are panes inside a resizable workspace: a pane narrowed by dragging the chat
 * sidebar open should reflow exactly the way a phone does. `useIsNarrow`
 * reports the same boundary to JS for the behaviour CSS cannot express — where
 * focus goes on selection, and whether Back is rendered.
 */

/** Width below which the pane shows one column at a time. */
const NARROW_PANE_PX = 720;

export function useIsNarrowPane<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  boolean,
] {
  const ref = React.useRef<T>(null);
  const [isNarrow, setIsNarrow] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setIsNarrow(entry.contentRect.width < NARROW_PANE_PX);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, isNarrow];
}

export interface MasterDetailProps {
  /** The list column. Always rendered on a wide pane. */
  list: React.ReactNode;
  /** The detail column, or the placeholder when nothing is selected. */
  detail: React.ReactNode;
  /** Whether a row is currently selected. Drives the narrow-pane switch. */
  selected: boolean;
  /** Called when the user backs out of the detail on a narrow pane. */
  onBack: () => void;
  /** Heading for the detail pane, shown beside Back on a narrow pane. */
  detailTitle?: string;
  /** Width of the list column on a wide pane. */
  listWidth?: string;
  className?: string;
}

export function MasterDetail({
  list,
  detail,
  selected,
  onBack,
  detailTitle,
  listWidth = "20rem",
  className,
}: MasterDetailProps) {
  const [ref, isNarrow] = useIsNarrowPane<HTMLDivElement>();
  const detailRef = React.useRef<HTMLDivElement>(null);
  const showDetail = !isNarrow || selected;
  const showList = !isNarrow || !selected;

  // Focus follows the visible pane, so a keyboard user is not left with focus
  // on a list row that is no longer on screen.
  React.useEffect(() => {
    if (isNarrow && selected) detailRef.current?.focus();
  }, [isNarrow, selected]);

  return (
    <div ref={ref} className={cn("flex min-h-0 min-w-0 flex-1", className)}>
      {showList && (
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col",
            isNarrow ? "flex-1" : "shrink-0 border-r border-border",
          )}
          style={isNarrow ? undefined : { width: listWidth }}
        >
          {list}
        </div>
      )}

      {showDetail && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {isNarrow && (
            <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="gap-1 px-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
              {detailTitle && (
                <span className="truncate text-sm font-medium text-foreground">
                  {detailTitle}
                </span>
              )}
            </div>
          )}
          <div
            ref={detailRef}
            // -1 so it can receive programmatic focus without becoming a tab
            // stop of its own.
            tabIndex={-1}
            className="flex min-h-0 min-w-0 flex-1 flex-col outline-none"
          >
            {detail}
          </div>
        </div>
      )}
    </div>
  );
}
