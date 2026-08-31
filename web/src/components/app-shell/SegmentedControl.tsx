import type { LucideIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The section switcher every app module needs.
 *
 * Four different tab languages had grown across the app modules — mailbox,
 * exercise and calendar each styled their own, and calendar additionally used
 * tab markup for a schedule list and a weekday picker, neither of which is a
 * tab set. This is one implementation with correct `tablist` semantics and a
 * roving tabindex, so arrow keys move between segments and only the active one
 * is a tab stop.
 *
 * The moving indicator is a single composited transform rather than a border
 * colour flip, and it is measured with a ResizeObserver rather than on every
 * frame.
 */

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Optional trailing count, e.g. unread messages. */
  badge?: number | string;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Accessible name for the tab list. */
  label: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  segments,
  value,
  onValueChange,
  label,
  className,
}: SegmentedControlProps<T>) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const refs = React.useRef(new Map<T, HTMLButtonElement>());
  const [indicator, setIndicator] = React.useState<{
    left: number;
    width: number;
  } | null>(null);

  const measure = React.useCallback(() => {
    const active = refs.current.get(value);
    const list = listRef.current;
    if (!active || !list) return;
    setIndicator({
      left: active.offsetLeft,
      width: active.offsetWidth,
    });
  }, [value]);

  React.useLayoutEffect(() => {
    measure();
  }, [measure, segments.length]);

  React.useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = segments.findIndex((segment) => segment.value === value);
    if (index === -1) return;
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % segments.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + segments.length) % segments.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = segments.length - 1;
    else return;

    event.preventDefault();
    const target = segments[next];
    onValueChange(target.value);
    refs.current.get(target.value)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-[var(--radius-md)]",
        "border border-border bg-surface-2 p-1",
        // The strip scrolls rather than wrapping or clipping when the pane is
        // narrower than the segments.
        "max-w-full overflow-x-auto scrollbar-none",
        className,
      )}
    >
      {indicator && (
        <span
          aria-hidden
          className="absolute bottom-1 top-1 rounded-[var(--radius-sm)] bg-card shadow-xs motion-safe:transition-[transform,width] motion-safe:duration-[var(--motion-duration-md)] motion-safe:ease-[var(--motion-ease-standard)]"
          style={{
            transform: `translateX(${indicator.left}px)`,
            width: indicator.width,
            left: 0,
          }}
        />
      )}

      {segments.map((segment) => {
        const Icon = segment.icon;
        const active = segment.value === value;
        return (
          <button
            key={segment.value}
            ref={(node) => {
              if (node) refs.current.set(segment.value, node);
              else refs.current.delete(segment.value);
            }}
            type="button"
            role="tab"
            aria-selected={active}
            // Roving tabindex: the strip is one tab stop, arrows move within it.
            tabIndex={active ? 0 : -1}
            onClick={() => onValueChange(segment.value)}
            className={cn(
              "relative z-10 inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap",
              "rounded-[var(--radius-sm)] px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
            {segment.label}
            {segment.badge !== undefined && segment.badge !== 0 && (
              <span
                className={cn(
                  "ml-0.5 rounded-full px-1.5 py-px text-[0.6875rem] font-semibold tabular-nums",
                  active
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {segment.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
