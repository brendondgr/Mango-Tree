import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Multi-line input matching `ui/input.tsx`.
 *
 * There is no shared textarea primitive yet, so this mirrors Input's tokens
 * exactly — same border, radius, ring and the `text-base` → `app:text-sm`
 * step that stops iOS from zooming the page on focus. It forwards every prop
 * so `Field` can clone `id` / `aria-invalid` / `aria-describedby` onto it.
 */
export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex w-full resize-y rounded-[var(--radius-sm)] border border-input bg-transparent px-3 py-2",
      "text-base shadow-xs transition-colors placeholder:text-muted-foreground app:text-sm",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
