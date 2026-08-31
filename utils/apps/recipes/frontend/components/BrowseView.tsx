import { ChefHat, Plus, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useIsNarrowPane } from "@/components/app-shell/MasterDetail";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SkeletonGrid } from "@/components/ui/skeleton";
import type { RecipeFilters } from "@/types/recipes";
import { FilterPanel } from "@recipes/components/FilterPanel";
import { RecipeCard } from "@recipes/components/RecipeCard";
import { useFilteredRecipes } from "@recipes/hooks/useRecipes";

/**
 * The recipe grid, with cuisine / meal / pantry filters beside it.
 *
 * The old layout put a `w-64 shrink-0` sidebar next to a grid whose smallest
 * track was 220px, inside an `overflow-hidden` ancestor. Below roughly 510px
 * those two demands exceeded the pane and the right-hand side of the grid was
 * *clipped* — not scrolled, not wrapped, simply unreachable. At 360px the
 * sidebar alone took 71% of the width.
 *
 * The fix is to stop treating the filters as a column that must always exist.
 * `useIsNarrowPane` — the same container-driven boundary `MasterDetail` uses,
 * measured on the pane rather than the viewport, because this pane is resized
 * by dragging the chat sidebar — decides between an inline column and a `Sheet`
 * launched from the toolbar. The grid keeps its full width either way, and its
 * track floor is `min(100%, 13rem)` so a single column can never be wider than
 * its container.
 */
interface BrowseViewProps {
  onSelect: (id: number) => void;
  /** Opens the editor, offered from the "no recipes yet" empty state. */
  onCreate: () => void;
}

/** Shared by the grid and its skeleton so the panel does not jump on load. */
const GRID_TRACKS =
  "[grid-template-columns:repeat(auto-fill,minmax(min(100%,13rem),1fr))]";

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function BrowseView({ onSelect, onCreate }: BrowseViewProps) {
  const [paneRef, isNarrow] = useIsNarrowPane<HTMLDivElement>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pantry, setPantry] = useState<Set<number>>(new Set());
  const [meals, setMeals] = useState<Set<string>>(new Set());
  const [cuisines, setCuisines] = useState<Set<string>>(new Set());

  const filters: RecipeFilters = useMemo(
    () => ({
      ingredient_ids: [...pantry],
      meal_types: [...meals],
      cuisine_regions: [...cuisines],
    }),
    [pantry, meals, cuisines],
  );

  const recipesQ = useFilteredRecipes(filters);

  // The Sheet renders inside `{isNarrow && …}`, so widening the pane unmounts
  // it without ever closing it. Left alone, `filtersOpen` stays true across the
  // round-trip and narrowing again re-mounts an open modal panel that traps
  // focus without the user asking — reachable just by dragging the chat sidebar
  // or rotating a phone.
  useEffect(() => {
    if (!isNarrow) setFiltersOpen(false);
  }, [isNarrow]);

  const activeCount = pantry.size + meals.size + cuisines.size;
  const recipes = recipesQ.data ?? [];

  const clearAll = useCallback(() => {
    setPantry(new Set());
    setMeals(new Set());
    setCuisines(new Set());
  }, []);

  const panel = (
    <FilterPanel
      selection={{ pantry, meals, cuisines }}
      onTogglePantry={(id) => setPantry((s) => toggle(s, id))}
      onToggleMeal={(value) => setMeals((s) => toggle(s, value))}
      onToggleCuisine={(value) => setCuisines((s) => toggle(s, value))}
    />
  );

  const clearButton = (
    <Button variant="ghost" onClick={clearAll}>
      <X className="h-4 w-4" />
      Clear {activeCount}
    </Button>
  );

  return (
    <div ref={paneRef} className="flex h-full min-h-0 min-w-0">
      {!isNarrow && (
        <aside
          aria-label="Recipe filters"
          className="flex w-[17rem] shrink-0 flex-col border-r border-border bg-surface-1"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
            <h3 className="text-sm font-semibold text-foreground">Filters</h3>
            {activeCount > 0 && <div className="ml-auto">{clearButton}</div>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{panel}</div>
        </aside>
      )}

      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        style={{ containerType: "inline-size" }}
      >
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-2 @[36rem]:px-4">
          <h3 className="text-sm font-semibold text-foreground">
            {activeCount > 0 ? "Matching recipes" : "All recipes"}
          </h3>
          <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {recipesQ.isLoading
              ? "Loading…"
              : `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}`}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {isNarrow ? (
              <Button
                variant="outline"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-primary px-1.5 py-px text-[0.6875rem] font-semibold tabular-nums text-primary-foreground">
                    {activeCount}
                  </span>
                )}
              </Button>
            ) : (
              activeCount > 0 && clearButton
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 @[36rem]:p-4">
          <AsyncBoundary
            loading={recipesQ.isLoading}
            error={recipesQ.error}
            empty={recipes.length === 0}
            onRetry={() => void recipesQ.refetch()}
            label="recipes"
            skeleton={<SkeletonGrid count={6} className={GRID_TRACKS} />}
            emptyIcon={activeCount > 0 ? SlidersHorizontal : ChefHat}
            emptyTitle={
              activeCount > 0 ? "No recipes match these filters" : "No recipes yet"
            }
            emptyDescription={
              activeCount > 0
                ? "Try removing an ingredient or a cuisine to widen the search."
                : "Add your first recipe, or paste one in and let the AI Chef fill out the form."
            }
            emptyAction={
              activeCount > 0 ? (
                <Button variant="outline" onClick={clearAll}>
                  <X className="h-4 w-4" />
                  Clear filters
                </Button>
              ) : (
                <Button onClick={onCreate}>
                  <Plus className="h-4 w-4" />
                  New recipe
                </Button>
              )
            }
          >
            <ul className={`grid gap-3 @[36rem]:gap-4 ${GRID_TRACKS}`}>
              {recipes.map((recipe, index) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  index={index}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </AsyncBoundary>
        </div>
      </div>

      {isNarrow && (
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetContent side="left" aria-describedby={undefined}>
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <SheetBody>{panel}</SheetBody>
            <SheetFooter>
              {activeCount > 0 && (
                <Button variant="outline" onClick={clearAll}>
                  <X className="h-4 w-4" />
                  Clear {activeCount}
                </Button>
              )}
              <Button onClick={() => setFiltersOpen(false)}>
                Show {recipes.length} recipe{recipes.length === 1 ? "" : "s"}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
