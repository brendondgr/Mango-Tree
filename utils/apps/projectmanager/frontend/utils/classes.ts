/**
 * Shared utility-class strings.
 *
 * There is no `Textarea` primitive in `web/src/components/ui`, and the app used
 * to solve that with a bespoke `.projectmanager-input` rule that drifted from
 * `Input` (different height, different radius, its own focus ring). This mirrors
 * `Input`'s classes exactly — including the 16px compact text size that stops
 * iOS from zooming on focus — so a textarea and a text field are the same
 * control at two heights.
 */
export const TEXTAREA_CLASS = [
  "flex min-h-[5.5rem] w-full resize-y rounded-[var(--radius-sm)]",
  "border border-input bg-transparent px-3 py-2 text-base shadow-xs",
  "transition-colors placeholder:text-muted-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "app:text-sm",
].join(" ");
