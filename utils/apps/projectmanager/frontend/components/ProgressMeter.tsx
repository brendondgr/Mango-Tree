import { cn } from "@/lib/utils";
import { categoryAccent } from "@projectmanager/utils/colors";

/**
 * Completion bar, filled in the project's category colour.
 *
 * `decorative` exists because the same bar appears twice: on a card, where the
 * percentage is already written beside it and a second announcement is noise,
 * and in the detail panel, where it is the only representation of progress and
 * therefore needs `role="progressbar"`.
 */
export function ProgressMeter({
  value,
  color,
  label,
  decorative = false,
  className,
}: {
  value: number;
  color?: string | null;
  label?: string;
  decorative?: boolean;
  className?: string;
}) {
  const pct = Math.min(Math.max(Math.round(value), 0), 100);

  return (
    <div
      style={categoryAccent(color)}
      className={cn(
        "h-2 w-full overflow-hidden rounded-[var(--radius-pill)] bg-surface-3",
        className,
      )}
      {...(decorative
        ? { "aria-hidden": true }
        : {
            role: "progressbar",
            "aria-valuenow": pct,
            "aria-valuemin": 0,
            "aria-valuemax": 100,
            "aria-label": label ?? "Progress",
          })}
    >
      <div
        className={cn(
          "h-full rounded-[var(--radius-pill)] bg-[hsl(var(--pm-accent))]",
          "transition-[width] duration-[var(--motion-duration-lg)] ease-[var(--motion-ease-standard)]",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
