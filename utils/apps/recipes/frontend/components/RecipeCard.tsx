import { useId } from "react";

import { cn } from "@/lib/utils";
import type { RecipeSummary } from "@/types/recipes";
import { RecipeImage } from "@recipes/components/RecipeImage";
import { accentColor } from "@recipes/utils/accent";
import { primaryImage, splitTags } from "@recipes/utils/format";

/**
 * One recipe in the browse grid.
 *
 * The whole tile is the hit area, but it is a single full-bleed button layered
 * over the card rather than a `role="button"` on the `<article>` itself. That
 * buys three things the old markup did not have: a real 200×250 target instead
 * of a text-sized one, `Space` and `Enter` handling for free, and an accessible
 * name taken from the visible title via `aria-labelledby` rather than being
 * reconstructed by a screen reader from the card's contents.
 */
export interface RecipeCardProps {
  recipe: RecipeSummary;
  /** Position in the grid — drives the entrance stagger. */
  index: number;
  onSelect: (id: number) => void;
}

export function RecipeCard({ recipe, index, onSelect }: RecipeCardProps) {
  const titleId = useId();
  const actionId = useId();
  const cuisine = splitTags(recipe.cuisine_region)[0];
  const meal = splitTags(recipe.meal_type)[0];
  const seed = cuisine || recipe.title;

  return (
    <li data-enter style={{ "--i": index } as never}>
      <article
        className={cn(
          "group relative flex h-full flex-col overflow-hidden",
          "rounded-[var(--radius-lg)] border border-border bg-card shadow-xs",
          "transition-shadow motion-safe:duration-[var(--motion-duration-md)]",
          "hover:shadow-md focus-within:ring-2 focus-within:ring-ring",
        )}
      >
        <RecipeImage
          src={primaryImage(recipe.images, recipe.image_url)}
          alt={recipe.title}
          seed={seed}
          className="aspect-[16/10] w-full shrink-0"
        />

        {recipe.match_percentage != null && (
          <span className="absolute left-2 top-2 rounded-[var(--radius-pill)] bg-primary px-2 py-0.5 text-[0.6875rem] font-semibold tabular-nums text-primary-foreground shadow-sm">
            {recipe.match_percentage}% match
          </span>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
          <h4
            id={titleId}
            className="line-clamp-2 break-words text-sm font-semibold leading-snug text-foreground"
          >
            {recipe.title}
          </h4>

          {recipe.description && (
            <p className="line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">
              {recipe.description}
            </p>
          )}

          {(cuisine || meal) && (
            <ul className="mt-auto flex min-w-0 flex-wrap gap-1.5 pt-1">
              {cuisine && (
                <li className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: accentColor(cuisine) }}
                  />
                  {cuisine}
                </li>
              )}
              {meal && (
                <li className="inline-flex items-center rounded-[var(--radius-pill)] bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground">
                  {meal}
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Last in the DOM so the focus ring paints above the card contents. */}
        <button
          type="button"
          // Named "Open recipe <title>" by composing the hidden verb with the
          // visible heading, so the button reads as an action rather than as a
          // bare repeat of the title.
          aria-labelledby={`${actionId} ${titleId}`}
          onClick={() => onSelect(recipe.id)}
          className="absolute inset-0 rounded-[var(--radius-lg)] focus-visible:outline-none"
        >
          <span id={actionId} className="sr-only">
            Open recipe
          </span>
        </button>
      </article>
    </li>
  );
}
