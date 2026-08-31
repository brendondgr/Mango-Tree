import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Placeholder blocks shown while content loads.
 *
 * Two rules make these useful rather than decorative:
 *
 * 1. **Reserve the real box.** A skeleton whose dimensions differ from the
 *    loaded content makes the panel jump when data arrives, which is worse
 *    than showing nothing. Match the shape you are standing in for.
 * 2. **Animate a transform, not a background position.** The shimmer is an
 *    absolutely-positioned overlay translated across an `overflow: hidden`
 *    parent, so it composites. Animating `background-position` repaints the
 *    whole box every frame.
 */

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-sm)] bg-muted/70",
        "after:absolute after:inset-0 after:-translate-x-full",
        "after:bg-gradient-to-r after:from-transparent after:via-foreground/[0.07] after:to-transparent",
        "motion-safe:after:animate-[skeleton-sweep_1.6s_ease-in-out_infinite]",
        className,
      )}
      {...props}
    />
  );
}

/** A single list row: leading square, two lines of text. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 py-2.5", className)}>
      <Skeleton className="h-9 w-9 shrink-0 rounded-[var(--radius-md)]" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

/** A card with a media area above a title and one line of body text. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card",
        className,
      )}
    >
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}

/** `count` rows, for a list or table body. */
export function SkeletonList({
  count = 5,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("divide-y divide-border", className)}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** `count` cards on the same auto-fill grid the loaded content uses. */
export function SkeletonGrid({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr))]",
        className,
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
