import type { MergedEvent } from "@/types/calendar";

import type { EventColor } from "../utils/colors";

export function EventChipMini({
  event,
  color,
  onClick,
}: {
  event: MergedEvent;
  color: EventColor;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="calendar-chip block"
      onClick={onClick}
      style={{ background: color.bg, borderLeftColor: color.border, color: color.text }}
      title={`${event.start} · ${event.title}`}
    >
      {event.title}
    </button>
  );
}
