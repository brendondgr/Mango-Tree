import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The "there is nothing here" surface.
 *
 * An empty state that only says what is absent leaves the user at a dead end.
 * Every one should offer the action that fills it, which is why `action` sits
 * in the API rather than being optional decoration.
 */
export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Reduces padding for use inside a pane rather than a full panel. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            "flex items-center justify-center rounded-[var(--radius-lg)]",
            "border border-border bg-surface-2 text-muted-foreground",
            compact ? "h-10 w-10" : "h-14 w-14",
          )}
          aria-hidden
        >
          <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} />
        </span>
      )}
      <p
        className={cn(
          "font-semibold text-foreground",
          compact ? "text-sm" : "text-base",
        )}
      >
        {title}
      </p>
      {description && (
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
