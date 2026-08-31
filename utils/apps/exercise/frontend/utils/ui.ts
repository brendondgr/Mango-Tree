/**
 * Shared class recipes for the exercise module.
 *
 * These replace the old `.exercise-glass` / `.exercise-card` CSS rules. They
 * are plain utility strings rather than bespoke CSS so the surfaces track the
 * shared elevation, radius and colour tokens instead of re-deriving them.
 */

/** A resting panel: the default surface for every section and card. */
export const CARD =
  "rounded-[var(--radius-lg)] border border-border bg-card shadow-xs";

/** A card the user can act on — lifts on hover, keeps a visible focus ring. */
export const CARD_INTERACTIVE = [
  CARD,
  "transition-[box-shadow,border-color,transform]",
  "duration-[var(--motion-duration-md)] ease-[var(--motion-ease-standard)]",
  "hover:-translate-y-[var(--motion-travel-sm)] hover:border-primary/40 hover:shadow-md",
  "focus-within:border-primary/40",
].join(" ");

/**
 * A compact chip that carries a workout's colour rail.
 *
 * `min-h-11` keeps the touch target at 44px on a compact viewport; `app:` steps
 * down to the denser desktop scale, the same rhythm the shared Button uses.
 */
export const CHIP = [
  "exercise-railed inline-flex min-h-11 w-full items-center gap-1.5",
  "rounded-[var(--radius-sm)] border border-border bg-surface-1 py-1 pl-3 pr-2",
  "text-left text-xs font-medium text-foreground transition-colors",
  "hover:border-primary/50 hover:bg-surface-2",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "app:min-h-8",
].join(" ");
