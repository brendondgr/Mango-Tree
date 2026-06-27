// Timeline-grid helpers, ported from the original Flask app's schedule_renderer.
//
// Both the Week view and the Schedules weekly editor render an hour-by-hour grid
// whose vertical range adapts to the events shown. Overwriteable events are split
// into visible segments around the non-overwriteable events they sit under, so a
// "free time" block reads as gaps rather than a solid bar behind real commitments.

/** A single event placed on the timeline. `dayIndex` indexes the visible days. */
export interface GridEvent {
  dayIndex: number;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  title: string;
  type: string;
  sub?: string;
  overwriteable?: boolean;
  /** Opaque passthrough for click handlers (e.g. the source event object). */
  meta?: unknown;
}

/** A render-ready segment: an event, possibly sliced around an overlap. */
export interface GridSegment extends GridEvent {
  _zIndex: number;
  _isSegment: boolean;
  /** Original (pre-slice) title, used as the display label for segments. */
  _parentTitle: string;
}

export function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "5AM", "12PM", "11PM" — matches the original time-column labels. */
export function formatHour(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 || 12;
  return `${displayHour}${period}`;
}

export function timeRangesOverlap(
  start1: number,
  end1: number,
  start2: number,
  end2: number,
): boolean {
  return start1 < end2 && end1 > start2;
}

export interface HourRange {
  startHour: number;
  endHour: number;
}

/**
 * Derive the visible hour range from the events: floor of the earliest start to
 * the ceil of the latest end. Falls back to `fallback` when there are no events,
 * and always returns at least `minSpan` hours so the grid never collapses.
 */
export function computeHourRange(
  events: Array<{ start: string; end: string }>,
  fallback: HourRange = { startHour: 8, endHour: 18 },
  minSpan = 4,
): HourRange {
  if (!events || events.length === 0) {
    return clampSpan(fallback, minSpan);
  }

  let minMinutes = Infinity;
  let maxMinutes = -Infinity;
  for (const evt of events) {
    minMinutes = Math.min(minMinutes, parseTimeToMinutes(evt.start));
    maxMinutes = Math.max(maxMinutes, parseTimeToMinutes(evt.end));
  }

  if (!Number.isFinite(minMinutes) || !Number.isFinite(maxMinutes)) {
    return clampSpan(fallback, minSpan);
  }

  const startHour = Math.max(0, Math.floor(minMinutes / 60));
  const endHour = Math.min(24, Math.ceil(maxMinutes / 60));
  return clampSpan({ startHour, endHour }, minSpan);
}

function clampSpan(range: HourRange, minSpan: number): HourRange {
  let { startHour, endHour } = range;
  if (endHour <= startHour) endHour = startHour + 1;
  if (endHour - startHour < minSpan) {
    endHour = Math.min(24, startHour + minSpan);
    if (endHour - startHour < minSpan) {
      startHour = Math.max(0, endHour - minSpan);
    }
  }
  return { startHour, endHour };
}

/**
 * Split overwriteable events around the non-overwriteable events they overlap,
 * so the visible portions read as gaps. Non-overwriteable events render on top
 * (higher z-index); untouched overwriteable events keep their full extent.
 */
export function processOverlapSegments(events: GridEvent[]): GridSegment[] {
  const nonOverwriteable = events.filter((e) => !e.overwriteable);
  const overwriteable = events.filter((e) => e.overwriteable);
  const result: GridSegment[] = [];

  for (const evt of nonOverwriteable) {
    result.push({ ...evt, _isSegment: false, _zIndex: 10, _parentTitle: evt.title });
  }

  for (const evt of overwriteable) {
    const evtStart = parseTimeToMinutes(evt.start);
    const evtEnd = parseTimeToMinutes(evt.end);

    const overlaps = nonOverwriteable
      .map((ne) => ({
        start: parseTimeToMinutes(ne.start),
        end: parseTimeToMinutes(ne.end),
      }))
      .filter((ne) => timeRangesOverlap(evtStart, evtEnd, ne.start, ne.end))
      .sort((a, b) => a.start - b.start);

    if (overlaps.length === 0) {
      result.push({ ...evt, _isSegment: false, _zIndex: 5, _parentTitle: evt.title });
      continue;
    }

    const segments: Array<{ start: number; end: number }> = [];
    let currentPos = evtStart;
    for (const overlap of overlaps) {
      if (currentPos < overlap.start) {
        segments.push({ start: currentPos, end: Math.min(overlap.start, evtEnd) });
      }
      currentPos = Math.max(currentPos, overlap.end);
    }
    if (currentPos < evtEnd) {
      segments.push({ start: currentPos, end: evtEnd });
    }

    for (const seg of segments) {
      result.push({
        ...evt,
        start: minutesToTimeStr(seg.start),
        end: minutesToTimeStr(seg.end),
        _isSegment: true,
        _zIndex: 5,
        _parentTitle: evt.title,
      });
    }
  }

  return result;
}

/** Hours [startHour, endHour) as an array, for rendering the time column. */
export function hoursIn(range: HourRange): number[] {
  const out: number[] = [];
  for (let h = range.startHour; h < range.endHour; h++) out.push(h);
  return out;
}
