import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A titled card. Both editor columns share this one shape so the AI panel and
 * the form read as siblings rather than as two unrelated boxes.
 *
 * The heading is an `h3`: `AppHeader` owns the pane's `h2`, so this is the next
 * level down and the ladder never skips.
 */
export function EditorPanel({
  title,
  icon: Icon,
  description,
  className,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-lg)] border border-border bg-card p-3 shadow-xs @[36rem]:p-4",
        className,
      )}
    >
      <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
        {Icon && <Icon className="h-4 w-4 text-primary-emphasis" aria-hidden />}
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}
