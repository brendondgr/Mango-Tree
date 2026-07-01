import { useEffect, useState } from "react";
import { Loader2, Sparkles, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadImage } from "@/services/recipesClient";
import {
  useCreateRecipe,
  useParseRecipe,
  useRecipe,
  useUpdateRecipe,
} from "@recipes/hooks/useRecipes";
import type { NewRecipe } from "@/types/recipes";

const CATEGORIES = [
  "Produce",
  "Dairy & Eggs",
  "Pantry / Dry Goods",
  "Canned / Jarred",
  "Proteins",
  "Spices & Baking",
  "Other",
];

interface IngRow {
  name: string;
  quantity: string;
  unit: string;
  is_optional: boolean;
  category: string;
}

const EMPTY_ING: IngRow = { name: "", quantity: "", unit: "", is_optional: false, category: "Other" };

interface RecipeEditorProps {
  recipeId: number | null;
  onSaved: (id: number) => void;
  onCancel: () => void;
}

export function RecipeEditor({ recipeId, onSaved, onCancel }: RecipeEditorProps) {
  const { data: existing } = useRecipe(recipeId);
  const createMutation = useCreateRecipe();
  const updateMutation = useUpdateRecipe();
  const parseMutation = useParseRecipe();

  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("4");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [mealType, setMealType] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [ingredients, setIngredients] = useState<IngRow[]>([{ ...EMPTY_ING }]);
  const [steps, setSteps] = useState<string[]>([""]);
  const [aiText, setAiText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
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
      setError((e as Error).message);
    }
  };

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { url } = await uploadImage(file);
      setImages((prev) => [...prev, url]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    setError(null);
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

    if (!title.trim()) return setError("Title is required.");
    if (cleanIngredients.length === 0) return setError("Add at least one ingredient.");
    if (cleanSteps.length === 0) return setError("Add at least one step.");

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

    const onError = (e: unknown) => setError((e as Error).message);
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
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid w-full max-w-5xl gap-6 p-4 lg:grid-cols-[1fr_1.6fr] lg:p-6">
        {/* AI Chef */}
        <section className="recipes-panel h-fit">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> AI Chef
          </h2>
          <p className="mb-2 mt-1 text-sm text-muted-foreground">
            Paste recipe text and let the assistant fill out the form.
          </p>
          <textarea
            className="recipes-textarea"
            rows={10}
            placeholder="Paste recipe text here…"
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
          />
          <Button
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
        </section>

        {/* Manual form */}
        <section className="recipes-panel">
          <h2 className="mb-3 text-base font-semibold">
            {recipeId != null ? "Edit Recipe" : "Recipe Details"}
          </h2>

          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div>
              <Label htmlFor="recipe-title">Title *</Label>
              <Input
                id="recipe-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Spicy Miso Ramen"
              />
            </div>
            <div>
              <Label htmlFor="recipe-servings">Servings</Label>
              <Input
                id="recipe-servings"
                type="number"
                min={1}
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-3">
            <Label htmlFor="recipe-desc">Description</Label>
            <textarea
              id="recipe-desc"
              className="recipes-textarea"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="recipe-cuisine">Cuisine Region</Label>
              <Input
                id="recipe-cuisine"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                placeholder="Italian"
              />
            </div>
            <div>
              <Label htmlFor="recipe-meal">Meal Type</Label>
              <Input
                id="recipe-meal"
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                placeholder="Dinner"
              />
            </div>
          </div>

          {/* Images */}
          <div className="mt-4">
            <Label>Images</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {images.map((url) => (
                <div key={url} className="recipes-image-thumb">
                  <img src={url} alt="" />
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={() => setImages((prev) => prev.filter((u) => u !== url))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Paste image URL…"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (newImageUrl.trim()) {
                    setImages((prev) => [...prev, newImageUrl.trim()]);
                    setNewImageUrl("");
                  }
                }}
              >
                Add
              </Button>
              <label className="recipes-upload-btn">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => onUpload(e.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          {/* Ingredients */}
          <div className="mt-4">
            <Label>Ingredients *</Label>
            <div className="mt-1 space-y-2">
              {ingredients.map((row, index) => (
                <div key={index} className="recipes-ing-row">
                  <select
                    className="recipes-select"
                    value={row.category}
                    onChange={(e) => updateIng(index, { category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Ingredient"
                    value={row.name}
                    onChange={(e) => updateIng(index, { name: e.target.value })}
                  />
                  <Input
                    className="w-16"
                    placeholder="Qty"
                    value={row.quantity}
                    onChange={(e) => updateIng(index, { quantity: e.target.value })}
                  />
                  <Input
                    className="w-20"
                    placeholder="Unit"
                    value={row.unit}
                    onChange={(e) => updateIng(index, { unit: e.target.value })}
                  />
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={row.is_optional}
                      onChange={(e) => updateIng(index, { is_optional: e.target.checked })}
                    />
                    opt
                  </label>
                  <button
                    type="button"
                    aria-label="Remove ingredient"
                    className="recipes-row-remove"
                    onClick={() => setIngredients((rows) => rows.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => setIngredients((rows) => [...rows, { ...EMPTY_ING }])}
            >
              + Add Ingredient
            </Button>
          </div>

          {/* Steps */}
          <div className="mt-4">
            <Label>Instructions *</Label>
            <div className="mt-1 space-y-2">
              {steps.map((step, index) => (
                <div key={index} className="recipes-step-row">
                  <span className="recipes-step-num">{index + 1}</span>
                  <textarea
                    className="recipes-textarea"
                    rows={2}
                    value={step}
                    onChange={(e) =>
                      setSteps((rows) => rows.map((s, i) => (i === index ? e.target.value : s)))
                    }
                  />
                  <button
                    type="button"
                    aria-label="Remove step"
                    className="recipes-row-remove"
                    onClick={() => setSteps((rows) => rows.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => setSteps((rows) => [...rows, ""])}
            >
              + Add Step
            </Button>
          </div>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {recipeId != null ? "Save Changes" : "Save Recipe"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
