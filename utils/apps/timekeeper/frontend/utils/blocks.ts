// Pure block <-> time helpers for the tracker grid. The day is 288 fixed
// 5-minute blocks (index 0 == 00:00 … 287 == 23:55), mirroring the backend
// (utils/apps/timekeeper/shared/intervals.py).

import type { Interval, TimeLog } from "@/types/timekeeper";

export const BLOCK_MINUTES = 5;
export const BLOCKS_PER_HOUR = 60 / BLOCK_MINUTES; // 12
export const BLOCKS_PER_DAY = 24 * BLOCKS_PER_HOUR; // 288

export function indexToHHMM(index: number): string {
  const minutes = index * BLOCK_MINUTES;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function hhmmToIndex(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (h * 60 + m) / BLOCK_MINUTES;
}

/** What a painted block holds: the category + subcategory ids (or null). */
export interface Paint {
  category_id: string | null;
  subcategory_id: string | null;
}

/** Expand a day's logs into a per-block paint map, keyed by block index. */
export function logsToPaint(logs: TimeLog[]): Map<number, Paint> {
  const map = new Map<number, Paint>();
  for (const log of logs) {
    if (log.duration <= 0) continue; // 0-min marker: a tracked-but-empty day
    const start = hhmmToIndex(log.start_time);
    const count = Math.round(log.duration / BLOCK_MINUTES);
    for (let i = 0; i < count; i++) {
      const idx = start + i;
      if (idx >= 0 && idx < BLOCKS_PER_DAY) {
        map.set(idx, { category_id: log.category_id, subcategory_id: log.subcategory_id });
      }
    }
  }
  return map;
}

/** Turn a paint map into the intervals payload for POST /logs/. */
export function paintToIntervals(paint: Map<number, Paint>): Interval[] {
  const intervals: Interval[] = [];
  for (const [index, p] of paint.entries()) {
    intervals.push({ index, category_id: p.category_id, subcategory_id: p.subcategory_id });
  }
  intervals.sort((a, b) => a.index - b.index);
  return intervals;
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayISO(): string {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10);
}
