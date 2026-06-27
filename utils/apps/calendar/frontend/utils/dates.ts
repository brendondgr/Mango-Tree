// Small date helpers for the calendar UI. Dates are "YYYY-MM-DD" strings parsed
// as LOCAL dates (never UTC) to avoid off-by-one day shifts. Day index is 0–6
// Monday–Sunday to match the backend.

export const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function today(): string {
  return formatDate(new Date());
}

export function addDays(s: string, days: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function addMonths(s: string, months: number): string {
  const d = parseDate(s);
  d.setMonth(d.getMonth() + months);
  return formatDate(d);
}

/** Monday-based day index 0–6 for a date string. */
export function dayOfWeek(s: string): number {
  return (parseDate(s).getDay() + 6) % 7;
}

/** The Monday of the week containing `s`. */
export function weekStart(s: string): string {
  return addDays(s, -dayOfWeek(s));
}

/** The seven date strings Mon..Sun for the week containing `s`. */
export function weekDates(s: string): string[] {
  const start = weekStart(s);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Inclusive list of date strings from start..end. */
export function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  // guard against runaway loops
  for (let i = 0; i < 3660 && cur <= end; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** The 6×7 grid of date strings covering the month of `s` (Mon-aligned). */
export function monthGrid(s: string): string[] {
  const d = parseDate(s);
  const first = formatDate(new Date(d.getFullYear(), d.getMonth(), 1));
  const gridStart = weekStart(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function monthLabel(s: string): string {
  const d = parseDate(s);
  return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}

export function dayNumber(s: string): number {
  return parseDate(s).getDate();
}

export function monthOf(s: string): number {
  return parseDate(s).getMonth();
}

export function prettyDate(s: string, includeYear = true): string {
  const d = parseDate(s);
  const base = `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
  return includeYear ? `${base}, ${d.getFullYear()}` : base;
}

/** "HH:MM" -> minutes since midnight. */
export function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
