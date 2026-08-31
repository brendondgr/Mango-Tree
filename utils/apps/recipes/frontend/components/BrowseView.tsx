import { useMemo, useState } from "react";

import { useFilterOptions, useFilteredRecipes, useIngredients } from "@recipes/hooks/useRecipes";
import { primaryImage, splitTags } from "@recipes/utils/format";
import type { RecipeFilters } from "@/types/recipes";

interface BrowseViewProps {
  onSelect: (id: number) => void;
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function BrowseView({ onSelect }: BrowseViewProps) {
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
  const ingredientsQ = useIngredients();
  const optionsQ = useFilterOptions();

  const activeCount = pantry.size + meals.size + cuisines.size;
  const recipes = recipesQ.data ?? [];

  return (
    <div className="flex h-full min-h-0">
      {/* Filter sidebar */}
      <aside className="recipes-sidebar w-64 shrink-0 overflow-y-auto border-r border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Filters</h2>
          {activeCount > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setPantry(new Set());
                setMeals(new Set());
                setCuisines(new Set());
              }}
            >
              Clear ({activeCount})
            </button>
          )}
        </div>

        <FilterGroup title="Cuisine">
          {(optionsQ.data?.cuisine_regions ?? []).map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="recipes-chip"
              data-active={cuisines.has(opt.value)}
              onClick={() => setCuisines((s) => toggle(s, opt.value))}
            >
              {opt.value}
            </button>
          ))}
        </FilterGroup>

        <FilterGroup title="Meal type">
          {(optionsQ.data?.meal_types ?? []).map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="recipes-chip"
              data-active={meals.has(opt.value)}
              onClick={() => setMeals((s) => toggle(s, opt.value))}
            >
              {opt.value}
            </button>
          ))}
        </FilterGroup>

        <div className="mb-1 mt-4 text-sm font-semibold">My Pantry</div>
        <p className="mb-2 text-xs text-muted-foreground">Select ingredients you have.</p>
        {Object.entries(ingredientsQ.data ?? {}).map(([category, items]) => (
          <div key={category} className="mb-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground">{category}</div>
            <div className="flex flex-wrap gap-1.5">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="recipes-chip"
                  data-active={pantry.has(item.id)}
                  onClick={() => setPantry((s) => toggle(s, item.id))}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </aside>

      {/* Recipe grid */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="text-lg font-semibold">Recipes</h1>
          <span className="text-sm text-muted-foreground">
            {recipesQ.isLoading ? "Loading…" : `${recipes.length} recipe${recipes.length === 1 ? "" : "s"}`}
          </span>
        </div>

        {recipesQ.isError && (
          <p className="text-sm text-destructive">{(recipesQ.error as Error).message}</p>
        )}

        {!recipesQ.isLoading && recipes.length === 0 && (
          <div className="recipes-empty">
            <p className="font-medium">No recipes match your filters</p>
            <p className="text-sm text-muted-foreground">
              Try selecting different ingredients or clearing your filters.
            </p>
          </div>
        )}

        <div className="recipes-grid">
          {recipes.map((recipe) => {
            const cuisine = splitTags(recipe.cuisine_region)[0];
            const meal = splitTags(recipe.meal_type)[0];
            return (
              <article
                key={recipe.id}
                className="recipes-card"
                role="button"
                tabIndex={0}
                onClick={() => onSelect(recipe.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelect(recipe.id);
                }}
              >
                <div className="recipes-card-image">
                  <img src={primaryImage(recipe.images, recipe.image_url)} alt={recipe.title} />
                  {recipe.match_percentage != null && (
                    <span className="recipes-match-badge">{recipe.match_percentage}% match</span>
                  )}
                </div>
                <div className="recipes-card-body">
                  <h3 className="recipes-card-title">{recipe.title}</h3>
                  {recipe.description && (
                    <p className="recipes-card-desc">{recipe.description}</p>
                  )}
                  <div className="recipes-card-tags">
                    {cuisine && <span className="recipes-tag">{cuisine}</span>}
                    {meal && <span className="recipes-tag">{meal}</span>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
