import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The header bar at the top of an app module's pane.
 *
 * Each app grew its own: different heights, different title sizes, different
 * action placement, and several with an un-wrapping action row that overflowed
 * the pane on a phone. One component means one rhythm across all eight, and
 * the actions wrap instead of spilling.
 */
export interface AppHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Section switcher, typically a SegmentedControl. */
  nav?: ReactNode;
  /** Trailing controls. Wrap onto their own row on a narrow pane. */
  actions?: ReactNode;
  className?: string;
}

export function AppHeader({
  icon: Icon,
  title,
  description,
  nav,
  actions,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2",
        "border-b border-border bg-card/60 px-3 py-2 backdrop-blur-sm sm:px-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {Icon && (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-primary/10 text-primary"
            aria-hidden
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      )}

      {nav && <div className="order-last w-full min-w-0">{nav}</div>}
    </header>
  );
}
