import { Loader2, Plus, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { Field, useFormErrors } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { uploadImage } from "@/services/recipesClient";
import { Textarea } from "@recipes/components/Textarea";
import { EditorPanel } from "@recipes/components/editor/EditorPanel";
import { ImagePicker } from "@recipes/components/editor/ImagePicker";
import { IngredientRow } from "@recipes/components/editor/IngredientRow";
import { StepRow } from "@recipes/components/editor/StepRow";
import {
  useCreateRecipe,
  useParseRecipe,
  useRecipe,
  useUpdateRecipe,
} from "@recipes/hooks/useRecipes";
import { EMPTY_ING, type IngRow } from "@recipes/utils/ingredientRow";
import type { NewRecipe } from "@/types/recipes";

/**
 * Create or edit a recipe.
 *
 * The two columns are driven by a container query on the editor's own scroll
 * area rather than by a viewport breakpoint, because this pane is resized by
 * dragging the chat sidebar: a 900px window with the sidebar open should reflow
 * exactly the way a phone does, and `lg:` could not see that.
 */

type FieldName = "title" | "ingredients" | "steps";

/**
 * Move focus to the control a collection-level error is about.
 *
 * `useFormErrors().focusFirstError` finds the first `aria-invalid` control,
 * which covers the single fields; the ingredient and step errors belong to a
 * list rather than to one input, so they name their target directly.
 */
function focusById(id: string) {
  requestAnimationFrame(() => document.getElementById(id)?.focus());
}

/** A fieldset legend with the same required marker `Field` renders. */
function RequiredLegend({ children }: { children: string }) {
  return (
    <legend className="text-sm font-medium leading-none">
      {children}
      <span className="ml-0.5 text-destructive" aria-hidden>
        *
      </span>
    </legend>
  );
}

function CollectionError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

/** Shared by the editor and its skeleton so the columns do not jump on load. */
const EDITOR_GRID =
  "mx-auto grid w-full max-w-5xl gap-4 p-3 @[36rem]:p-6 @[56rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] @[56rem]:items-start";

/** Stands in for the two columns while an existing recipe is being fetched. */
function EditorSkeleton() {
  return (
    <div className={EDITOR_GRID}>
      <div className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-card p-3 shadow-xs @[36rem]:p-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
      <div className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-card p-3 shadow-xs @[36rem]:p-4">
        <Skeleton className="h-5 w-36" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-11 min-w-[12rem] flex-[3_1_14rem]" />
          <Skeleton className="h-11 w-[6.5rem] flex-none" />
        </div>
        <Skeleton className="h-16 w-full" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-11 min-w-[9rem] flex-1" />
          <Skeleton className="h-11 min-w-[9rem] flex-1" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}

interface RecipeEditorProps {
  recipeId: number | null;
  onSaved: (id: number) => void;
  onCancel: () => void;
}

export function RecipeEditor({ recipeId, onSaved, onCancel }: RecipeEditorProps) {
  const recipeQuery = useRecipe(recipeId);
  const existing = recipeQuery.data;
  const createMutation = useCreateRecipe();
  const updateMutation = useUpdateRecipe();
  const parseMutation = useParseRecipe();

  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("4");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [mealType, setMealType] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<IngRow[]>([{ ...EMPTY_ING }]);
  const [steps, setSteps] = useState<string[]>([""]);
  const [aiText, setAiText] = useState("");

  const formRef = useRef<HTMLFormElement>(null);
  const { errors, formError, setFormError, setFieldError, clear, focusFirstError } =
    useFormErrors<FieldName>();

  // `useRecipe` is disabled without an id, so only the edit case can be pending
  // or failing. Until the record is in hand the form must not render: it would
  // be a blank but fully interactive "Edit Recipe" whose Save writes an empty
  // payload over the real row, and whose fields the effect below would then
  // overwrite anyway, silently discarding whatever had been typed.
  const editingExisting = recipeId != null;
  const loadingRecipe = editingExisting && recipeQuery.isPending;
  const loadError = editingExisting ? recipeQuery.error : null;
  const loaded = !editingExisting || existing != null;

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setServings(String(existing.servings ?? 4));
    setDescription(existing.description ?? "");
    setCuisine(existing.cuisine_region ?? "");
    setMealType(existing.meal_type ?? "");
    setImages(existing.images);
    setIngredients(
      existing.ingredients.length > 0
        ? existing.ingredients.map((i) => ({
            name: i.name,
            quantity: i.quantity != null ? String(i.quantity) : "",
            unit: i.unit ?? "",
            is_optional: i.is_optional,
            category: "Other",
          }))
        : [{ ...EMPTY_ING }],
    );
    setSteps(existing.steps.length > 0 ? existing.steps.map((s) => s.instruction) : [""]);
  }, [existing]);

  const updateIng = (index: number, patch: Partial<IngRow>) =>
    setIngredients((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const runParse = async () => {
    clear();
    try {
      const parsed = await parseMutation.mutateAsync(aiText);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.description) setDescription(parsed.description);
      if (parsed.servings != null) setServings(String(parsed.servings));
      if (parsed.cuisine) setCuisine(parsed.cuisine);
      if (parsed.meal_type) setMealType(parsed.meal_type);
      if (parsed.ingredients?.length) {
        setIngredients(
          parsed.ingredients.map((i) => ({
            name: i.name ?? "",
            quantity: i.quantity != null ? String(i.quantity) : "",
            unit: i.unit ?? "",
            is_optional: Boolean(i.is_optional),
            category: "Other",
          })),
        );
      }
      if (parsed.steps?.length) setSteps(parsed.steps);
    } catch (e) {
      setFormError((e as Error).message);
    }
  };

  const onUpload = async (file: File) => {
    setFormError(null);
    try {
      const { url } = await uploadImage(file);
      setImages((prev) => [...prev, url]);
    } catch (e) {
      setFormError((e as Error).message);
    }
  };

  const submit = () => {
    clear();
    const cleanIngredients = ingredients
      .filter((i) => i.name.trim())
      .map((i) => {
        const q = i.quantity.trim();
        const num = Number(q);
        return {
          name: i.name.trim(),
          quantity: q === "" || !Number.isFinite(num) ? null : num,
          unit: i.unit.trim() || null,
          is_optional: i.is_optional,
          category: i.category,
        };
      });
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);

    // The same three rules as before, but each reported on the control that
    // failed — and focused — instead of as one red sentence at the bottom of a
    // form long enough to have scrolled it out of view.
    if (!title.trim()) {
      setFieldError("title", "Title is required.");
      requestAnimationFrame(() => focusFirstError(formRef.current));
      return;
    }
    if (cleanIngredients.length === 0) {
      setFieldError("ingredients", "Add at least one ingredient.");
      focusById("ing-name-0");
      return;
    }
    if (cleanSteps.length === 0) {
      setFieldError("steps", "Add at least one step.");
      focusById("step-0");
      return;
    }

    const payload: NewRecipe = {
      title: title.trim(),
      description: description.trim() || null,
      servings: Number(servings) || 4,
      cuisine_region: cuisine.trim() || null,
      meal_type: mealType.trim() || null,
      image_urls: images,
      ingredients: cleanIngredients,
      steps: cleanSteps,
    };

    const onError = (e: unknown) => setFormError((e as Error).message);
    if (recipeId != null) {
      updateMutation.mutate(
        { id: recipeId, recipe: payload },
        { onSuccess: (r) => onSaved(r.id), onError },
      );
    } else {
      createMutation.mutate(payload, { onSuccess: (r) => onSaved(r.id), onError });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="h-full overflow-y-auto" style={{ containerType: "inline-size" }}>
      <AsyncBoundary
        loading={loadingRecipe}
        error={loadError}
        onRetry={() => void recipeQuery.refetch()}
        label="this recipe"
        skeleton={<EditorSkeleton />}
      >
        <div className={EDITOR_GRID}>
          <EditorPanel
            title="AI Chef"
            icon={Sparkles}
            description="Paste recipe text and let the assistant fill out the form."
          >
            <Textarea
              aria-label="Recipe text to parse"
              rows={10}
              placeholder="Paste recipe text here…"
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
            />
            <Button
              type="button"
              className="mt-2 w-full"
              variant="outline"
              disabled={parseMutation.isPending || !aiText.trim()}
              onClick={runParse}
            >
              {parseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Magic Parse
            </Button>
          </EditorPanel>

          <form
            ref={formRef}
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="min-w-0"
          >
            <EditorPanel title={recipeId != null ? "Edit Recipe" : "Recipe Details"}>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start gap-3">
                  <Field
                    label="Title"
                    required
                    error={errors.title}
                    className="min-w-[12rem] flex-[3_1_14rem]"
                  >
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Spicy Miso Ramen"
                    />
                  </Field>
                  <Field label="Servings" className="w-[6.5rem] flex-none">
                    <Input
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={servings}
                      onChange={(e) => setServings(e.target.value)}
                    />
                  </Field>
                </div>

                <Field label="Description">
                  <Textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Field>

                <div className="flex flex-wrap items-start gap-3">
                  <Field label="Cuisine region" className="min-w-[9rem] flex-1">
                    <Input
                      value={cuisine}
                      onChange={(e) => setCuisine(e.target.value)}
                      placeholder="Italian"
                    />
                  </Field>
                  <Field label="Meal type" className="min-w-[9rem] flex-1">
                    <Input
                      value={mealType}
                      onChange={(e) => setMealType(e.target.value)}
                      placeholder="Dinner"
                    />
                  </Field>
                </div>

                <ImagePicker
                  images={images}
                  onAdd={(url) => setImages((prev) => [...prev, url])}
                  onRemove={(url) => setImages((prev) => prev.filter((u) => u !== url))}
                  onUpload={onUpload}
                />

                <fieldset className="min-w-0">
                  <RequiredLegend>Ingredients</RequiredLegend>
                  <ul className="mt-2 flex flex-col gap-2">
                    {ingredients.map((row, index) => (
                      <IngredientRow
                        key={index}
                        row={row}
                        index={index}
                        onChange={(patch) => updateIng(index, patch)}
                        onRemove={() =>
                          setIngredients((rows) => rows.filter((_, i) => i !== index))
                        }
                      />
                    ))}
                  </ul>
                  <CollectionError message={errors.ingredients} />
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-2"
                    onClick={() => setIngredients((rows) => [...rows, { ...EMPTY_ING }])}
                  >
                    <Plus className="h-4 w-4" />
                    Add ingredient
                  </Button>
                </fieldset>

                <fieldset className="min-w-0">
                  <RequiredLegend>Instructions</RequiredLegend>
                  <ol className="mt-2 flex flex-col gap-2">
                    {steps.map((step, index) => (
                      <StepRow
                        key={index}
                        value={step}
                        index={index}
                        onChange={(value) =>
                          setSteps((rows) => rows.map((s, i) => (i === index ? value : s)))
                        }
                        onRemove={() => setSteps((rows) => rows.filter((_, i) => i !== index))}
                      />
                    ))}
                  </ol>
                  <CollectionError message={errors.steps} />
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-2"
                    onClick={() => setSteps((rows) => [...rows, ""])}
                  >
                    <Plus className="h-4 w-4" />
                    Add step
                  </Button>
                </fieldset>

                {formError && (
                  <p
                    role="alert"
                    className="rounded-[var(--radius-sm)] border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
                  >
                    {formError}
                  </p>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving || !loaded}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    {recipeId != null ? "Save Changes" : "Save Recipe"}
                  </Button>
                </div>
              </div>
            </EditorPanel>
          </form>
        </div>
      </AsyncBoundary>
    </div>
  );
}
