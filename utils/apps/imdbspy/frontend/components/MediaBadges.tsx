import { Star } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { MediaStatus } from "@/types/imdbspy";

/**
 * The small coloured chips the card and the row both use.
 *
 * Colour comes from the shared `--category-*` scale via a `--c` binding, the
 * same indirection the calendar module uses: one inline custom property, and
 * the tint / border / dot are all derived from it in static utility classes
 * that Tailwind can actually see at build time.
 *
 * The hue is carried by the BORDER, the 14-18% tint and (where it helps) a
 * solid dot — never by the label text. The category tokens are identical
 * across the light and dark themes, so a token used as small text passes
 * contrast on the dark four and fails on the light four; a tint behind
 * `text-foreground` is correct on all eight.
 */

export type CategoryToken =
  | "amber"
  | "crimson"
  | "mint"
  | "sky"
  | "violet";

/** Binds `--c` for the `hsl(var(--c) / …)` utilities below to read. */
export function categoryStyle(token: CategoryToken | "muted"): CSSProperties {
  const value =
    token === "muted" ? "var(--muted-foreground)" : `var(--category-${token})`;
  return { "--c": value } as CSSProperties;
}

const CHIP =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide";

/** Hue-tinted chip: coloured border and wash, always-readable label. */
const TONE = "border-[hsl(var(--c)/0.5)] bg-[hsl(var(--c)/0.16)] text-foreground";

export function KindBadge({ tv, className }: { tv: boolean; className?: string }) {
  return (
    <span
      style={categoryStyle(tv ? "violet" : "sky")}
      className={cn(CHIP, TONE, className)}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--c))]" aria-hidden />
      {tv ? "TV Series" : "Movie"}
    </span>
  );
}

export const STATUS_LABELS: Record<MediaStatus, string> = {
  not_seen: "Not Seen",
  seen: "Seen",
  abandoned: "Abandoned",
};

const STATUS_TOKEN: Record<MediaStatus, CategoryToken | "muted"> = {
  not_seen: "muted",
  seen: "mint",
  abandoned: "crimson",
};

/** Inline props for anything that should take a status' hue. */
export function statusTone(status: MediaStatus) {
  return { style: categoryStyle(STATUS_TOKEN[status]), className: TONE };
}

export function StatusDot({ status }: { status: MediaStatus }) {
  return (
    <span
      style={categoryStyle(STATUS_TOKEN[status])}
      className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--c))]"
      aria-hidden
    />
  );
}

/**
 * Outline only, no fill. `text-muted-foreground` on `bg-surface-2` measures
 * 3.99:1 on the dark theme; against the card it is 4.55:1, so the pill reads
 * as a pill through its border rather than through a tint that costs contrast.
 */
export function GenrePill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-[var(--radius-pill)] border border-border px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * A 0-10 score. `tone` distinguishes the site's rating from the user's own —
 * amber for IMDb, the theme's primary for yours — and each carries a visible
 * or assistive label, so the colour is never the only thing telling them apart.
 */
export function RatingBadge({
  tone,
  value,
  className,
}: {
  tone: "imdb" | "user";
  value: number;
  className?: string;
}) {
  const label = tone === "imdb" ? "IMDb rating" : "Your rating";
  return (
    <span
      title={label}
      style={tone === "imdb" ? categoryStyle("amber") : undefined}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-sm font-bold tabular-nums",
        tone === "imdb"
          ? TONE
          : "border-primary/45 bg-primary/12 text-foreground",
        className,
      )}
    >
      <Star className="h-3.5 w-3.5 fill-current opacity-80" aria-hidden />
      <span className="sr-only">{label}: </span>
      {value.toFixed(1)}
    </span>
  );
}
