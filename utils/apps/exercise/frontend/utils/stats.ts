// Aggregation helpers for the dashboard, ported from the original
// WorkoutTracker dashboard.js. Pure functions over the history logs.

import type { HistoryLog } from "@/types/exercise";

export type Scope = "all" | "year" | "month" | "week";
export type GraphType = "time" | "volume" | "distance";
export type Aggregation = "weekly" | "monthly";
export type ActivityType = "all" | "run" | "walk";

const MI_PER_KM = 0.621371;
const KM_PER_MI = 1.60934;

export function safeDate(value: string): Date {
  if (typeof value === "string" && value.length === 10 && !value.includes("T")) {
    return new Date(`${value}T12:00:00`);
  }
  return new Date(value);
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isThisYear(value: string): boolean {
  return safeDate(value).getFullYear() === new Date().getFullYear();
}

function isThisMonth(value: string): boolean {
  const d = safeDate(value);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function isThisWeek(value: string): boolean {
  const d = safeDate(value);
  const start = getWeekStart(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  d.setHours(0, 0, 0, 0);
  return d >= start && d <= end;
}

function inScope(value: string, scope: Scope): boolean {
  if (scope === "all") return true;
  if (scope === "year") return isThisYear(value);
  if (scope === "month") return isThisMonth(value);
  return isThisWeek(value);
}

function matchesType(log: HistoryLog, type: ActivityType): boolean {
  if (type === "all") return log.workout_id !== "run" && log.workout_id !== "walk";
  return log.workout_id === type;
}

function logDistanceMiles(log: HistoryLog): number {
  let total = 0;
  for (const ex of log.exercises ?? []) {
    const raw = (ex as { distance?: unknown }).distance;
    if (raw == null) continue;
    let d = parseFloat(String(raw)) || 0;
    if ((ex as { unit?: unknown }).unit === "km") d *= MI_PER_KM;
    total += d;
  }
  return total;
}

export function countByTypeScope(logs: HistoryLog[], type: ActivityType, scope: Scope): number {
  return logs.filter((log) => matchesType(log, type) && inScope(log.date, scope)).length;
}

export function hoursByTypeScope(logs: HistoryLog[], type: ActivityType, scope: Scope): number {
  return logs
    .filter((log) => matchesType(log, type) && inScope(log.date, scope))
    .reduce((sum, log) => sum + (log.duration || 0) / 3600, 0);
}

/** Distance in miles (internal). Use formatDistance for display units. */
export function distanceByTypeScope(logs: HistoryLog[], type: "run" | "walk", scope: Scope): number {
  return logs
    .filter((log) => log.workout_id === type && inScope(log.date, scope))
    .reduce((sum, log) => sum + logDistanceMiles(log), 0);
}

export function displayDistance(miles: number, useMetric: boolean): number {
  return useMetric ? miles * KM_PER_MI : miles;
}

export interface Bucket {
  start: number;
  end: number;
  label: string;
}

export function defaultDateRange(aggregation: Aggregation): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  if (aggregation === "weekly") start.setDate(end.getDate() - 84);
  else start.setMonth(end.getMonth() - 12);
  return { start, end };
}

export function getBuckets(aggregation: Aggregation, start: Date, end: Date): Bucket[] {
  const buckets: Bucket[] = [];
  let current = new Date(start);
  current.setHours(0, 0, 0, 0);

  if (aggregation === "weekly") {
    current = getWeekStart(current);
    while (current <= end) {
      const bStart = new Date(current);
      const bEnd = new Date(current);
      bEnd.setDate(bEnd.getDate() + 6);
      bEnd.setHours(23, 59, 59, 999);
      buckets.push({
        start: bStart.getTime(),
        end: bEnd.getTime(),
        label: `${bStart.getMonth() + 1}/${bStart.getDate()}`,
      });
      current.setDate(current.getDate() + 7);
    }
  } else {
    while (current <= end) {
      const bStart = getMonthStart(current);
      const bEnd = new Date(bStart);
      bEnd.setMonth(bEnd.getMonth() + 1);
      bEnd.setDate(0);
      bEnd.setHours(23, 59, 59, 999);
      buckets.push({
        start: bStart.getTime(),
        end: bEnd.getTime(),
        label: bStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      });
      current.setMonth(current.getMonth() + 1);
    }
  }
  return buckets;
}

export function filterByRange(logs: HistoryLog[], start: Date, end: Date): HistoryLog[] {
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  return logs.filter((log) => {
    const t = safeDate(log.date).getTime();
    return t >= s.getTime() && t <= e.getTime();
  });
}

export interface Series {
  key: string;
  label: string;
  colorClass: string; // .exercise-c-* class supplying --c
  values: number[];
}

export function buildSeries(
  graphType: GraphType,
  logs: HistoryLog[],
  buckets: Bucket[],
  useMetric: boolean,
): Series[] {
  const inBucket = (log: HistoryLog, b: Bucket) => {
    const t = safeDate(log.date).getTime();
    return t >= b.start && t <= b.end;
  };

  if (graphType === "time") {
    const ex: number[] = [];
    const run: number[] = [];
    const walk: number[] = [];
    for (const b of buckets) {
      let e = 0, r = 0, w = 0;
      for (const log of logs) {
        if (!inBucket(log, b)) continue;
        const h = (log.duration || 0) / 3600;
        if (log.workout_id === "run") r += h;
        else if (log.workout_id === "walk") w += h;
        else e += h;
      }
      ex.push(+e.toFixed(2));
      run.push(+r.toFixed(2));
      walk.push(+w.toFixed(2));
    }
    return [
      { key: "exercise", label: "Exercise", colorClass: "exercise-c-exercise", values: ex },
      { key: "run", label: "Run", colorClass: "exercise-c-run", values: run },
      { key: "walk", label: "Walk", colorClass: "exercise-c-walk", values: walk },
    ];
  }

  if (graphType === "volume") {
    const vol: number[] = [];
    for (const b of buckets) {
      let v = 0;
      for (const log of logs) {
        if (log.workout_id === "run" || log.workout_id === "walk") continue;
        if (inBucket(log, b)) v += log.volume || 0;
      }
      vol.push(+v.toFixed(0));
    }
    return [{ key: "volume", label: "Volume", colorClass: "exercise-c-emerald", values: vol }];
  }

  // distance
  const run: number[] = [];
  const walk: number[] = [];
  for (const b of buckets) {
    let r = 0, w = 0;
    for (const log of logs) {
      if (log.workout_id !== "run" && log.workout_id !== "walk") continue;
      if (!inBucket(log, b)) continue;
      const d = displayDistance(logDistanceMiles(log), useMetric);
      if (log.workout_id === "run") r += d;
      else w += d;
    }
    run.push(+r.toFixed(2));
    walk.push(+w.toFixed(2));
  }
  return [
    { key: "run", label: "Run", colorClass: "exercise-c-run", values: run },
    { key: "walk", label: "Walk", colorClass: "exercise-c-walk", values: walk },
  ];
}
