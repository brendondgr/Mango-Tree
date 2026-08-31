import { ArrowLeft, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";

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
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RecipeImage } from "@recipes/components/RecipeImage";
import { useDeleteRecipe, useRecipe } from "@recipes/hooks/useRecipes";
import { accentColor } from "@recipes/utils/accent";
import { primaryImage, scaleQuantity, splitTags } from "@recipes/utils/format";

interface RecipeDetailProps {
  recipeId: number;
  onBack: () => void;
  onEdit: (id: number) => void;
  onDeleted: () => void;
}

function DetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="aspect-[16/7] w-full rounded-[var(--radius-lg)]" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <div className="grid gap-8 pt-4 @[44rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function RecipeDetail({
  recipeId,
  onBack,
  onEdit,
  onDeleted,
}: RecipeDetailProps) {
  const query = useRecipe(recipeId);
  const recipe = query.data;
  const deleteMutation = useDeleteRecipe();
  const [servings, setServings] = useState<number>(1);
  const servingsLabelId = useId();

  const baseServings = recipe?.servings ?? 1;
  useEffect(() => {
    if (recipe) setServings(recipe.servings ?? 1);
  }, [recipe]);

  const tags = recipe
    ? [...splitTags(recipe.cuisine_region), ...splitTags(recipe.meal_type)]
    : [];
  const seed = recipe ? splitTags(recipe.cuisine_region)[0] || recipe.title : "";

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ containerType: "inline-size" }}
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-3 @[36rem]:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            All recipes
          </Button>

          {recipe && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => onEdit(recipe.id)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{recipe.title}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the recipe, its ingredients, and its
                      steps.
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
          )}
        </div>

        <AsyncBoundary
          loading={query.isLoading}
          error={query.error ?? (query.isSuccess && !recipe ? "Recipe not found." : undefined)}
          onRetry={() => void query.refetch()}
          label="this recipe"
          skeleton={<DetailSkeleton />}
        >
          {recipe && (
            <article className="flex flex-col gap-4">
              <RecipeImage
                src={primaryImage(recipe.images, recipe.image_url)}
                alt={recipe.title}
                seed={seed}
                className="aspect-[16/7] w-full rounded-[var(--radius-lg)] border border-border"
                iconClassName="h-10 w-10"
              />

              <div className="flex flex-col gap-2">
                <h3 className="break-words text-xl font-bold leading-tight text-foreground @[36rem]:text-2xl">
                  {recipe.title}
                </h3>
                {tags.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <li
                        key={tag}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted-foreground"
                      >
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: accentColor(tag) }}
                        />
                        {tag}
                      </li>
                    ))}
                  </ul>
                )}
                {recipe.description && (
                  <p className="break-words text-sm leading-relaxed text-muted-foreground">
                    {recipe.description}
                  </p>
                )}
              </div>

              <div className="grid gap-6 pt-2 @[44rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] @[44rem]:gap-8">
                <section className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-base font-semibold text-foreground">
                      Ingredients
                    </h4>
                    <div
                      role="group"
                      aria-labelledby={servingsLabelId}
                      className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-border bg-surface-1 p-0.5"
                    >
                      {/*
                        The name and the live value are separate nodes on
                        purpose. When the readout was both, every increment
                        re-announced the group's name along with it.
                      */}
                      <span id={servingsLabelId} className="sr-only">
                        Servings
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-[var(--radius-pill)]"
                        aria-label="Fewer servings"
                        disabled={servings <= 1}
                        onClick={() => setServings((s) => Math.max(1, s - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span
                        aria-live="polite"
                        className="min-w-[5.5rem] text-center text-xs font-medium tabular-nums text-foreground"
                      >
                        {servings} serving{servings === 1 ? "" : "s"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-[var(--radius-pill)]"
                        aria-label="More servings"
                        onClick={() => setServings((s) => s + 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {recipe.ingredients.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      This recipe has no ingredients listed.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border text-sm">
                      {recipe.ingredients.map((ing) => {
                        const qty = scaleQuantity(ing.quantity, baseServings, servings);
                        return (
                          <li
                            key={`${ing.id}-${ing.name}`}
                            className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 break-words py-2"
                          >
                            {qty && (
                              <span className="font-semibold tabular-nums text-foreground">
                                {qty}
                              </span>
                            )}
                            {ing.unit && (
                              <span className="text-muted-foreground">{ing.unit}</span>
                            )}
                            <span className="text-foreground">{ing.name}</span>
                            {ing.is_optional && (
                              <span className="text-xs text-muted-foreground">
                                (optional)
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>

                <section className="min-w-0">
                  <h4 className="mb-3 text-base font-semibold text-foreground">
                    Instructions
                  </h4>
                  {recipe.steps.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      This recipe has no steps yet.
                    </p>
                  ) : (
                    <ol className="flex flex-col gap-3">
                      {recipe.steps.map((step, index) => (
                        <li
                          key={step.step_number}
                          data-enter
                          style={{ "--i": index } as never}
                          className="flex items-start gap-2.5 text-sm leading-relaxed"
                        >
                          <span
                            aria-hidden
                            className="mt-px inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-primary text-xs font-semibold text-primary-foreground"
                          >
                            {step.step_number}
                          </span>
                          <span className="min-w-0 break-words text-foreground">
                            {step.instruction}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
            </article>
          )}
        </AsyncBoundary>
      </div>
    </div>
  );
}
