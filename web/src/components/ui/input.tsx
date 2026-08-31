import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // iOS Safari zooms the page whenever a focused control renders below
          // 16px, and does not reliably zoom back out. text-base on compact is
          // what stops the first tap of the login form from leaving the user
          // zoomed in; app: steps back down to the denser desktop scale.
          "flex h-11 w-full rounded-[var(--radius-sm)] border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors app:h-9 app:text-sm",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
