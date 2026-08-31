import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Multi-line counterpart to `@/components/ui/input`.
 *
 * There is no shared `Textarea` primitive yet, and recipes needs three of them.
 * The class list deliberately mirrors `Input`: same radius token, same border
 * and ring treatment, and the same `text-base` → `app:text-sm` step, because
 * iOS Safari zooms the page whenever a focused control renders below 16px.
 */
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex w-full resize-y rounded-[var(--radius-sm)] border border-input bg-transparent",
      "px-3 py-2 text-base shadow-xs transition-colors app:text-sm",
      "placeholder:text-muted-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
