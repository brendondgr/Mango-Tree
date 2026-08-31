import { Carrot, SlidersHorizontal } from "lucide-react";
import { useId } from "react";

import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useFilterOptions, useIngredients } from "@recipes/hooks/useRecipes";

/**
 * Cuisine / meal-type / pantry selection.
 *
 * Rendered inline as a column on a wide pane and inside a `Sheet` on a narrow
 * one, so it takes its selection entirely as props and owns nothing but its
 * queries — the same panel, in two containers, with one source of truth.
 */

export interface FilterSelection {
  pantry: Set<number>;
  meals: Set<string>;
  cuisines: Set<string>;
}

export interface FilterPanelProps {
  selection: FilterSelection;
  onTogglePantry: (id: number) => void;
  onToggleMeal: (value: string) => void;
  onToggleCuisine: (value: string) => void;
}

function FilterChip({
  label,
  count,
  active,
  onToggle,
}: {
  label: string;
  count?: number;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      // aria-pressed, not a colour change, is what tells assistive tech the
      // chip is on. The compact height clears the 44px touch target and steps
      // down on the expanded shell where a pointer is precise.
      aria-pressed={active}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-[var(--radius-pill)] border px-3",
        "break-words py-1 text-left text-xs font-medium transition-colors app:min-h-8",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-xs"
          : "border-border bg-card text-foreground hover:border-primary/60 hover:bg-surface-2",
      )}
    >
      {label}
      {count != null && count > 0 && (
        <span className="tabular-nums opacity-70">{count}</span>
      )}
    </button>
  );
}

function ChipGroup({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  const labelId = useId();
  return (
    <section>
      <p id={labelId} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {description && (
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      )}
      {/* A labelled group rather than a heading: these name a set of controls,
          they are not document structure, so they cannot break heading order. */}
      <div
        role="group"
        aria-labelledby={labelId}
        className="mt-2 flex flex-wrap gap-1.5"
      >
        {children}
      </div>
    </section>
  );
}

function ChipSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          key={i}
          className="h-11 rounded-[var(--radius-pill)] app:h-8"
          style={{ width: `${4 + ((i * 3) % 5)}rem` }}
        />
      ))}
    </div>
  );
}

export function FilterPanel({
  selection,
  onTogglePantry,
  onToggleMeal,
  onToggleCuisine,
}: FilterPanelProps) {
  const optionsQ = useFilterOptions();
  const ingredientsQ = useIngredients();

  const cuisines = optionsQ.data?.cuisine_regions ?? [];
  const meals = optionsQ.data?.meal_types ?? [];
  const pantry = Object.entries(ingredientsQ.data ?? {});

  return (
    <div className="space-y-5">
      <AsyncBoundary
        loading={optionsQ.isLoading}
        error={optionsQ.error}
        empty={cuisines.length === 0 && meals.length === 0}
        onRetry={() => void optionsQ.refetch()}
        label="filters"
        skeleton={
          <div className="space-y-5">
            <ChipSkeleton count={5} />
            <ChipSkeleton count={4} />
          </div>
        }
        emptyIcon={SlidersHorizontal}
        emptyTitle="Nothing to filter by yet"
        emptyDescription="Cuisines and meal types appear once your recipes have them."
        className="space-y-5"
      >
        {cuisines.length > 0 && (
          <ChipGroup label="Cuisine">
            {cuisines.map((option) => (
              <FilterChip
                key={option.value}
                label={option.value}
                count={option.count}
                active={selection.cuisines.has(option.value)}
                onToggle={() => onToggleCuisine(option.value)}
              />
            ))}
          </ChipGroup>
        )}

        {meals.length > 0 && (
          <ChipGroup label="Meal type">
            {meals.map((option) => (
              <FilterChip
                key={option.value}
                label={option.value}
                count={option.count}
                active={selection.meals.has(option.value)}
                onToggle={() => onToggleMeal(option.value)}
              />
            ))}
          </ChipGroup>
        )}
      </AsyncBoundary>

      <section className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-foreground">My Pantry</p>
          <p className="text-xs text-muted-foreground">
            Pick what you already have — recipes are ranked by how much of it they use.
          </p>
        </div>

        <AsyncBoundary
        loading={ingredientsQ.isLoading}
        error={ingredientsQ.error}
        empty={pantry.length === 0}
        onRetry={() => void ingredientsQ.refetch()}
        label="your pantry"
        skeleton={
          <div className="space-y-4">
            <ChipSkeleton count={6} />
            <ChipSkeleton count={4} />
          </div>
        }
        emptyIcon={Carrot}
        emptyTitle="No ingredients yet"
        emptyDescription="Ingredients you add to recipes show up here as pantry filters."
        className="space-y-4"
      >
        {pantry.map(([category, items]) => (
          <ChipGroup key={category} label={category}>
            {items.map((item) => (
              <FilterChip
                key={item.id}
                label={item.name}
                active={selection.pantry.has(item.id)}
                onToggle={() => onTogglePantry(item.id)}
              />
            ))}
          </ChipGroup>
        ))}
        </AsyncBoundary>
      </section>
    </div>
  );
}
