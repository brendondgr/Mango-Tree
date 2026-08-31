import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A panel anchored to an edge of the viewport.
 *
 * This is the compact-shell counterpart to `Dialog`. A centred dialog is the
 * wrong shape on a phone: it wastes the horizontal axis, and its controls end
 * up in the middle of the screen rather than under the thumb. A bottom sheet
 * puts the content where the hand already is, and the enter transform is a
 * single composited property.
 *
 * Radix Dialog supplies the focus trap, focus restoration on close, scroll
 * locking, and Escape handling, so the sheet is keyboard-complete for free.
 */

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "anim-overlay fixed inset-0 z-[var(--z-sheet)] bg-black/50",
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = "SheetOverlay";

type SheetSide = "bottom" | "left";

const SIDE_CLASSES: Record<SheetSide, string> = {
  bottom: cn(
    "anim-sheet-bottom inset-x-0 bottom-0 rounded-t-[var(--radius-lg)] border-t",
    // Never taller than the visible viewport, and clear of the home indicator.
    "max-h-[85dvh] pb-[env(safe-area-inset-bottom,0px)]",
  ),
  left: cn(
    "anim-sheet-left inset-y-0 left-0 h-full w-[min(88vw,22rem)] border-r",
    "pl-[env(safe-area-inset-left,0px)]",
  ),
};

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: SheetSide;
  /** Render the drag affordance at the top of a bottom sheet. */
  showHandle?: boolean;
}

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, side = "bottom", showHandle = true, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed z-[var(--z-sheet)] flex flex-col border-border bg-card shadow-xl",
        SIDE_CLASSES[side],
        className,
      )}
      {...props}
    >
      {side === "bottom" && showHandle && (
        <div className="flex shrink-0 justify-center pb-1 pt-2.5" aria-hidden>
          <span className="h-1 w-9 rounded-full bg-muted-foreground/40" />
        </div>
      )}
      {children}
      <DialogPrimitive.Close
        className={cn(
          "absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center",
          "rounded-[var(--radius-sm)] text-muted-foreground",
          "transition-colors hover:bg-muted hover:text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = "SheetContent";

function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex shrink-0 flex-col gap-1 px-4 pb-3 pr-12 pt-2", className)}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto px-4 pb-4", className)}
      {...props}
    />
  );
}

function SheetFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold tracking-tight", className)}
    {...props}
  />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = "SheetDescription";

export {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
