// Types for the calendar app API.
// Mirrors utils/apps/calendar/shared/ (schemas, colors) and the JSON stores.

export interface ApiErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

// --- colors -----------------------------------------------------------------

export interface ColorClasses {
  bg: string;
  border: string;
  text: string;
  hover: string;
}

export interface PaletteColor extends ColorClasses {
  name: string;
  bgHex: string;
  borderHex: string;
  textHex: string;
}

/** Per-type color map returned by merged views (Tailwind class names). */
export type ColorMap = Record<string, ColorClasses>;

// --- schedules --------------------------------------------------------------

export interface Timestamp {
  day: number | number[];
  start: string;
  end: string;
}

/** A schedule event. Either legacy flat day/start/end or a timestamps[] list. */
export interface ScheduleEvent {
  title: string;
  type: string;
  sub?: string;
  overwriteable?: boolean;
  day?: number | number[];
  start?: string;
  end?: string;
  timestamps?: Timestamp[];
  _original_idx?: number;
}

export interface Schedule {
  name: string;
  description?: string;
  events: ScheduleEvent[];
  color_mappings: Record<string, string>;
}

export interface ScheduleStats {
  total: number;
  by_category: Record<string, number>;
}

export interface BreakdownItem {
  title: string;
  sub: string;
  day: number;
  hours: number;
}

export interface ScheduleDetail {
  schedule: Schedule;
  colors: ColorMap;
  stats: ScheduleStats;
  breakdowns: Record<string, BreakdownItem[]>;
}

export interface SchedulesList {
  schedules: string[];
  count: number;
}

// --- calendar config + events -----------------------------------------------

export interface CalendarEntry {
  start_date: string;
  end_date: string;
  schedule_filename: string;
}

export interface DirectEvent {
  date: string;
  title: string;
  type: string;
  start: string;
  end: string;
  sub?: string;
  _direct_index?: number;
}

export interface CalendarConfig {
  entries: CalendarEntry[];
  direct_events: DirectEvent[];
}

/** An event in a merged day/week/range view. */
export interface MergedEvent {
  title: string;
  type: string;
  start: string;
  end: string;
  sub?: string;
  day?: number;
  overwriteable?: boolean;
  _source?: "schedule" | "direct";
  _split?: "before" | "after";
  _direct_index?: number;
  _original_idx?: number;
}

export interface ScheduleColor {
  bg: string;
  text: string;
  border: string;
}

export interface DayView {
  date: string;
  schedule_filename: string | null;
  events: MergedEvent[];
  colors: ColorMap;
}

export interface DayBucket {
  schedule_filename: string | null;
  schedule_name: string | null;
  schedule_color: ScheduleColor | null;
  events: MergedEvent[];
}

export interface MultiDayView {
  days: Record<string, DayBucket>;
  colors: ColorMap;
}

export interface WeekView extends MultiDayView {
  week_start: string;
  week_end: string;
}

export interface RangeView extends MultiDayView {
  start_date: string;
  end_date: string;
}

// --- helpers (agent-flavored) -----------------------------------------------

export interface FreeSlot {
  start: string;
  end: string;
  duration_minutes: number;
}

export interface FreeSlotsResult {
  date: string;
  start_after: string;
  end_before: string;
  min_duration_minutes: number;
  free_slots: FreeSlot[];
}

export interface UpcomingResult {
  today: string;
  days_ahead: number;
  end_date: string;
  type_filter: string | null;
  events: DirectEvent[];
  count: number;
}

// --- request payloads -------------------------------------------------------

export interface DirectEventInput {
  date: string;
  title: string;
  type: string;
  start: string;
  end: string;
  sub?: string;
}

export interface PrintViewState {
  timeRange?: { startHour?: number; endHour?: number };
  daysRange?: number[] | null;
  hiddenCategories?: string[];
}
