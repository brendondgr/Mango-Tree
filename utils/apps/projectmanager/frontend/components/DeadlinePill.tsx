import { AlertTriangle, CalendarClock, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DeadlineStatus } from "@/types/projectmanager";
import { deadlineTone } from "@projectmanager/utils/colors";

const TONE_CLASS = {
  overdue: "border-destructive/50 bg-destructive/10 text-destructive",
  warning:
    "border-[hsl(var(--category-amber))] bg-[hsl(var(--category-amber)/0.14)] text-foreground",
  normal: "border-border bg-surface-2 text-muted-foreground",
} as const;

const TONE_ICON = {
  overdue: AlertTriangle,
  warning: Clock,
  normal: CalendarClock,
} as const;

/**
 * A deadline as a pill.
 *
 * Tone is never carried by colour alone: each tone has its own icon, and
 * overdue additionally prefixes the accessible name, so the state survives a
 * greyscale screen and a screen reader alike.
 */
export function DeadlinePill({
  status,
  short = false,
  className,
}: {
  status: DeadlineStatus;
  /** Prefer the compact date form where the row is tight. */
  short?: boolean;
  className?: string;
}) {
  const tone = deadlineTone(status.css_class);
  const Icon = TONE_ICON[tone];
  const text = short ? (status.date_short ?? status.display) : status.display;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-[var(--radius-pill)] border",
        "px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {tone === "overdue" && <span className="sr-only">Overdue: </span>}
      <span className="truncate">{text}</span>
    </span>
  );
}
