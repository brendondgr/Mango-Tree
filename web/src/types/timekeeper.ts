// Types for the timekeeper app. Mirrors the JSON in docs/api.md under "Time
// Keeper". No logic here — shapes only.

export interface ApiErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export interface ListResponse<T> {
  count: number;
  next: number | null;
  previous: number | null;
  results: T[];
}

export interface TimeLog {
  id: number;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  duration: number; // minutes
  category_id: string | null;
  subcategory_id: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface Subcategory {
  id: string;
  name: string;
  l: number; // 0..100 shade level
}

export interface Category {
  id: string;
  name: string;
  colorId: string;
  subcategories: Subcategory[];
}

export interface DailyTotal {
  date: string;
  total_duration: number;
}

/** One painted 5-minute block, as sent to POST /logs/. */
export interface Interval {
  index: number;
  category_id: string | null;
  subcategory_id: string | null;
}

export interface SaveDayResponse {
  date: string;
  logs: TimeLog[];
}
