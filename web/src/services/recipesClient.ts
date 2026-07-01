// API client for the recipes app. Request/response only — no business logic.
// Endpoints documented in docs/api.md under "Recipes".

import type {
  IngredientsByCategory,
  ListResponse,
  NewRecipe,
  ParsedRecipe,
  RecipeDetail,
  RecipeFilters,
  RecipeSummary,
  Ingredient,
  FilterOptions,
} from "@/types/recipes";
import type { ApiErrorBody } from "@/types/recipes";

const UNREACHABLE =
  "Cannot reach the recipes API. Start the backend with `uv run manage.py runserver`.";

async function parseError(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return {
      code: "internal_error",
      message: response.statusText || "Request failed",
      details: {},
    };
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      headers: init?.body && typeof init.body === "string"
        ? { "Content-Type": "application/json" }
        : undefined,
      ...init,
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  if (!response.ok) {
    const error = await parseError(response);
    throw new Error(error.message || error.code);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

const BASE = "/api/recipes";
const ALL = "?page_size=2000";

// --- recipes ----------------------------------------------------------------

export function listRecipes(): Promise<ListResponse<RecipeSummary>> {
  return request<ListResponse<RecipeSummary>>(`${BASE}/recipes/${ALL}`);
}

export function filterRecipes(filters: RecipeFilters): Promise<ListResponse<RecipeSummary>> {
  return request<ListResponse<RecipeSummary>>(`${BASE}/recipes/filter/${ALL}`, {
    method: "POST",
    body: JSON.stringify(filters),
  });
}

export function getRecipe(id: number): Promise<RecipeDetail> {
  return request<RecipeDetail>(`${BASE}/recipes/${id}/`);
}

export function createRecipe(recipe: NewRecipe): Promise<RecipeDetail> {
  return request<RecipeDetail>(`${BASE}/recipes/`, {
    method: "POST",
    body: JSON.stringify(recipe),
  });
}

export function updateRecipe(id: number, recipe: NewRecipe): Promise<RecipeDetail> {
  return request<RecipeDetail>(`${BASE}/recipes/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(recipe),
  });
}

export function deleteRecipe(id: number): Promise<void> {
  return request<void>(`${BASE}/recipes/${id}/`, { method: "DELETE" });
}

// --- ingredients + filter options -------------------------------------------

export function listIngredients(): Promise<IngredientsByCategory> {
  return request<IngredientsByCategory>(`${BASE}/ingredients/`);
}

export function searchIngredients(query: string): Promise<Ingredient[]> {
  return request<Ingredient[]>(`${BASE}/ingredients/search/?q=${encodeURIComponent(query)}`);
}

export function getFilterOptions(): Promise<FilterOptions> {
  return request<FilterOptions>(`${BASE}/filter-options/`);
}

// --- AI Chef + images -------------------------------------------------------

export function parseRecipe(text: string): Promise<ParsedRecipe> {
  return request<ParsedRecipe>(`${BASE}/parse/`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function uploadImage(file: File): Promise<{ success: boolean; url: string }> {
  const form = new FormData();
  form.append("image", file);
  return request<{ success: boolean; url: string }>(`${BASE}/images/`, {
    method: "POST",
    body: form,
  });
}
