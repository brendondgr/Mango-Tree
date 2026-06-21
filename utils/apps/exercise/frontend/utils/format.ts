export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  const secs = seconds % 60;
  return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function dayKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

const WORKOUT_COLOR_CLASS: Record<string, string> = {
  blue: "exercise-c-blue",
  indigo: "exercise-c-indigo",
  violet: "exercise-c-violet",
  rose: "exercise-c-rose",
  emerald: "exercise-c-emerald",
  amber: "exercise-c-amber",
};

export function workoutColorClass(color: string | null | undefined): string {
  return (color && WORKOUT_COLOR_CLASS[color]) || "exercise-c-indigo";
}

