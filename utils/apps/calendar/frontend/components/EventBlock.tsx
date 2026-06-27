import type { MergedEvent } from "@/types/calendar";

import type { EventColor } from "../utils/colors";

export function EventBlock({
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
      className="calendar-event"
      onClick={onClick}
      style={{ background: color.bg, borderLeftColor: color.border, color: color.text }}
      title={`${event.start}–${event.end} · ${event.title}${event.sub ? ` · ${event.sub}` : ""}`}
    >
      <span className="calendar-event-time">
        {event.start}–{event.end}
      </span>
      <span className="calendar-event-title block">{event.title}</span>
      {event.sub ? <span className="calendar-event-time block">{event.sub}</span> : null}
    </button>
  );
}

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
