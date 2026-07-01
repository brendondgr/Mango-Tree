import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/services/recipesClient";
import type { NewRecipe, RecipeFilters } from "@/types/recipes";

export const RECIPES_KEYS = {
  list: ["recipes", "list"] as const,
  filtered: (filters: RecipeFilters) => ["recipes", "filtered", filters] as const,
  detail: (id: number) => ["recipes", "detail", id] as const,
  ingredients: ["recipes", "ingredients"] as const,
  filterOptions: ["recipes", "filter-options"] as const,
};

// --- queries ----------------------------------------------------------------

export function useFilteredRecipes(filters: RecipeFilters) {
  return useQuery({
    queryKey: RECIPES_KEYS.filtered(filters),
    queryFn: async () => (await api.filterRecipes(filters)).results,
  });
}

export function useRecipe(id: number | null) {
  return useQuery({
    queryKey: id == null ? ["recipes", "detail", "none"] : RECIPES_KEYS.detail(id),
    queryFn: () => api.getRecipe(id as number),
    enabled: id != null,
  });
}

export function useIngredients() {
  return useQuery({
    queryKey: RECIPES_KEYS.ingredients,
    queryFn: () => api.listIngredients(),
  });
}

export function useFilterOptions() {
  return useQuery({
    queryKey: RECIPES_KEYS.filterOptions,
    queryFn: () => api.getFilterOptions(),
  });
}

// --- mutations --------------------------------------------------------------

function useInvalidateRecipes() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["recipes", "list"] });
    qc.invalidateQueries({ queryKey: ["recipes", "filtered"] });
    qc.invalidateQueries({ queryKey: ["recipes", "ingredients"] });
    qc.invalidateQueries({ queryKey: ["recipes", "filter-options"] });
  };
}

export function useCreateRecipe() {
  const invalidate = useInvalidateRecipes();
  return useMutation({
    mutationFn: (recipe: NewRecipe) => api.createRecipe(recipe),
    onSuccess: invalidate,
  });
}

export function useUpdateRecipe() {
  const invalidate = useInvalidateRecipes();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, recipe }: { id: number; recipe: NewRecipe }) =>
      api.updateRecipe(id, recipe),
    onSuccess: (_data, { id }) => {
      invalidate();
      qc.invalidateQueries({ queryKey: RECIPES_KEYS.detail(id) });
    },
  });
}

export function useDeleteRecipe() {
  const invalidate = useInvalidateRecipes();
  return useMutation({
    mutationFn: (id: number) => api.deleteRecipe(id),
    onSuccess: invalidate,
  });
}

export function useParseRecipe() {
  return useMutation({
    mutationFn: (text: string) => api.parseRecipe(text),
  });
}
