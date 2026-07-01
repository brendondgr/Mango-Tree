// Types for the recipes app API.
// Mirrors utils/apps/recipes/shared/schemas.py.

export interface ApiErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export interface ListResponse<T> {
  count: number;
  next: number | null;
  previous: number | null;
  results: T[];
}

export interface RecipeSummary {
  id: number;
  title: string;
  description: string | null;
  servings: number | null;
  cuisine_region: string | null;
  meal_type: string | null;
  image_url: string | null;
  images: string[];
  total_ingredients: number;
  matched_ingredients: number;
  match_percentage: number | null;
}

export interface RecipeIngredient {
  id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  is_optional: boolean;
}

export interface RecipeStep {
  step_number: number;
  instruction: string;
}

export interface RecipeDetail {
  id: number;
  title: string;
  description: string | null;
  servings: number | null;
  cuisine_region: string | null;
  meal_type: string | null;
  image_url: string | null;
  images: string[];
  ingredients: RecipeIngredient[];
  steps: RecipeStep[];
}

export interface IngredientInput {
  name: string;
  quantity?: number | string | null;
  unit?: string | null;
  is_optional?: boolean;
  category?: string;
}

export interface NewRecipe {
  title: string;
  description?: string | null;
  servings?: number;
  cuisine_region?: string | null;
  meal_type?: string | null;
  image_urls?: string[];
  ingredients: IngredientInput[];
  steps: string[];
}

export interface Ingredient {
  id: number;
  name: string;
  category: string;
}

export type IngredientsByCategory = Record<string, { id: number; name: string }[]>;

export interface FilterOption {
  value: string;
  count: number;
}

export interface FilterOptions {
  meal_types: FilterOption[];
  cuisine_regions: FilterOption[];
}

export interface RecipeFilters {
  ingredient_ids?: number[];
  meal_types?: string[];
  cuisine_regions?: string[];
}

// Shape returned by the AI Chef parser (POST /api/recipes/parse/).
export interface ParsedRecipe {
  title?: string;
  description?: string;
  servings?: number | string;
  cuisine?: string;
  meal_type?: string;
  ingredients?: Array<{
    name: string;
    quantity?: number | string;
    unit?: string;
    is_optional?: boolean;
  }>;
  steps?: string[];
}
