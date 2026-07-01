import { useEffect, useState } from "react";
import { ArrowLeft, Minus, Pencil, Plus, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteRecipe, useRecipe } from "@recipes/hooks/useRecipes";
import { primaryImage, scaleQuantity, splitTags } from "@recipes/utils/format";

interface RecipeDetailProps {
  recipeId: number;
  onBack: () => void;
  onEdit: (id: number) => void;
  onDeleted: () => void;
}

export function RecipeDetail({ recipeId, onBack, onEdit, onDeleted }: RecipeDetailProps) {
  const { data: recipe, isLoading, isError, error } = useRecipe(recipeId);
  const deleteMutation = useDeleteRecipe();
  const [servings, setServings] = useState<number>(1);

  const baseServings = recipe?.servings ?? 1;
  useEffect(() => {
    if (recipe) setServings(recipe.servings ?? 1);
  }, [recipe]);

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading recipe…</div>;
  }
  if (isError || !recipe) {
    return (
      <div className="p-6">
        <Button size="sm" variant="outline" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <p className="mt-4 text-sm text-destructive">
          {(error as Error)?.message ?? "Recipe not found."}
        </p>
      </div>
    );
  }

  const tags = [...splitTags(recipe.cuisine_region), ...splitTags(recipe.meal_type)];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl p-4 lg:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Menu
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(recipe.id)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive">
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete “{recipe.title}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the recipe, its ingredients, and its steps.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      deleteMutation.mutate(recipe.id, { onSuccess: onDeleted })
                    }
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="recipes-hero">
          <img src={primaryImage(recipe.images, recipe.image_url)} alt={recipe.title} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{recipe.title}</h1>
          {tags.map((tag) => (
            <span key={tag} className="recipes-tag">
              {tag}
            </span>
          ))}
        </div>
        {recipe.description && <p className="mt-2 text-muted-foreground">{recipe.description}</p>}

        <div className="mt-6 grid gap-8 md:grid-cols-[1fr_1.4fr]">
          {/* Ingredients */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ingredients</h2>
              <div className="recipes-servings">
                <button
                  type="button"
                  aria-label="Fewer servings"
                  onClick={() => setServings((s) => Math.max(1, s - 1))}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span>{servings} servings</span>
                <button
                  type="button"
                  aria-label="More servings"
                  onClick={() => setServings((s) => s + 1)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <ul className="recipes-ing-list">
              {recipe.ingredients.map((ing) => {
                const qty = scaleQuantity(ing.quantity, baseServings, servings);
                return (
                  <li key={`${ing.id}-${ing.name}`}>
                    {qty && <span className="recipes-ing-qty">{qty}</span>}
                    {ing.unit && <span className="recipes-ing-unit">{ing.unit}</span>}
                    <span className="recipes-ing-name">{ing.name}</span>
                    {ing.is_optional && <span className="recipes-ing-opt">(optional)</span>}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Steps */}
          <section>
            <h2 className="mb-3 text-lg font-semibold">Instructions</h2>
            <ol className="recipes-steps">
              {recipe.steps.map((step) => (
                <li key={step.step_number}>
                  <span className="recipes-step-num">{step.step_number}</span>
                  <span>{step.instruction}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
