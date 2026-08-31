import { cn } from "@/lib/utils";
import { categoryAccent } from "@projectmanager/utils/colors";

/**
 * The category chip.
 *
 * The colour rides on a dot rather than on the text, because the categorical
 * palette is a mid-lightness data palette: it is legible as a mark against any
 * theme surface, and would fail text contrast on several of them. The label
 * itself stays `text-foreground`, so the badge reads at any theme while the
 * category still has a colour identity.
 */
export function CategoryBadge({
  name,
  color,
  className,
}: {
  name: string;
  color?: string | null;
  className?: string;
}) {
  return (
    <span
      style={categoryAccent(color)}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-[var(--radius-pill)]",
        "border border-border bg-surface-2 px-2 py-0.5",
        "text-xs font-medium text-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--pm-accent))]"
      />
      <span className="truncate">{name}</span>
    </span>
  );
}
