import type { MergedEvent } from "@/types/calendar";

import { categoryStyle, type CategoryColor } from "../utils/colors";

/**
 * A month-cell event chip. Renders as a button only when it can actually be
 * opened — schedule-derived events have no editor, and a control that does
 * nothing when activated is worse than plain text for a keyboard user.
 */
export function EventChipMini({
  event,
  color,
  onClick,
}: {
  event: MergedEvent;
  color: CategoryColor;
  onClick?: () => void;
}) {
  const className =
    "calendar-tint block min-h-6 w-full truncate rounded-[var(--radius-pill)] border-l-[3px] px-2 text-left text-[0.7rem] leading-6";
  const style = categoryStyle(color);
  const title = `${event.start}–${event.end} · ${event.title}`;

  if (!onClick) {
    return (
      <span className={className} style={style} title={title}>
        {event.title}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`${className} focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[hsl(var(--ring))]`}
      style={style}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {event.title}
    </button>
  );
}

/**
 * The compact stand-in for a chip. Below roughly 640px of pane width a month
 * cell is about 45px across, which cannot hold a legible title — so the cell
 * shows how many events there are and in which categories, and the list below
 * the grid carries the detail.
 */
export function EventDot({ color }: { color: CategoryColor }) {
  return (
    <span
      aria-hidden
      className="calendar-solid h-1.5 w-1.5 shrink-0 rounded-full"
      style={categoryStyle(color)}
    />
  );
}
