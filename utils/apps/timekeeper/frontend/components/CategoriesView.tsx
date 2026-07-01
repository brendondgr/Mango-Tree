import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Category } from "@/types/timekeeper";

import { useSaveCategories } from "@timekeeper/hooks/useTimekeeper";
import { COLOR_IDS, categoryColor, subcategoryColor } from "@timekeeper/utils/colors";

interface Props {
  categories: Category[];
}

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function CategoriesView({ categories }: Props) {
  const save = useSaveCategories();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_IDS[0]);

  function commit(next: Category[]) {
    save.mutate(next);
  }

  function addCategory() {
    const name = newName.trim();
    if (!name) return;
    commit([
      ...categories,
      { id: genId("cat"), name, colorId: newColor, subcategories: [] },
    ]);
    setNewName("");
  }

  function deleteCategory(id: string) {
    commit(categories.filter((c) => c.id !== id));
  }

  function addSubcategory(catId: string, name: string, l: number) {
    if (!name.trim()) return;
    commit(
      categories.map((c) =>
        c.id === catId
          ? {
              ...c,
              subcategories: [
                ...c.subcategories,
                { id: genId("sub"), name: name.trim(), l },
              ],
            }
          : c,
      ),
    );
  }

  function deleteSubcategory(catId: string, subId: string) {
    commit(
      categories.map((c) =>
        c.id === catId
          ? { ...c, subcategories: c.subcategories.filter((s) => s.id !== subId) }
          : c,
      ),
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-4 lg:p-6">
      <div>
        <h2 className="text-xl font-bold">Category Management</h2>
        <p className="text-sm text-muted-foreground">
          Organize tracking with base categories and subcategory shades.
        </p>
      </div>

      {/* add category */}
      <div className="timekeeper-card flex flex-wrap items-center gap-2 p-3">
        <Input
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCategory()}
          className="w-52"
        />
        <div className="flex items-center gap-1">
          {COLOR_IDS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => setNewColor(c)}
              className="timekeeper-swatch"
              style={{
                background: categoryColor(c),
                width: "1.4rem",
                height: "1.4rem",
                outline: newColor === c ? "2px solid hsl(var(--primary))" : "none",
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
        <Button onClick={addCategory} disabled={!newName.trim() || save.isPending}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>

      {save.isError && (
        <p className="text-sm text-destructive">{(save.error as Error).message}</p>
      )}

      {/* category cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            onDelete={() => deleteCategory(cat.id)}
            onAddSub={(name, l) => addSubcategory(cat.id, name, l)}
            onDeleteSub={(subId) => deleteSubcategory(cat.id, subId)}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  onDelete,
  onAddSub,
  onDeleteSub,
}: {
  category: Category;
  onDelete: () => void;
  onAddSub: (name: string, l: number) => void;
  onDeleteSub: (subId: string) => void;
}) {
  const [subName, setSubName] = useState("");
  const [shade, setShade] = useState(50);

  return (
    <div className="timekeeper-card flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-semibold">
          <span
            className="timekeeper-swatch"
            style={{ background: categoryColor(category.colorId), width: "1rem", height: "1rem" }}
          />
          {category.name}
        </span>
        <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Delete ${category.name}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        {category.subcategories.length === 0 && (
          <span className="text-xs text-muted-foreground">No subcategories yet.</span>
        )}
        {category.subcategories.map((sub) => (
          <div key={sub.id} className="flex items-center gap-2 text-sm">
            <span
              className="timekeeper-swatch"
              style={{ background: subcategoryColor(category.colorId, sub.l) }}
            />
            <span className="flex-1 truncate">{sub.name}</span>
            <span className="text-xs text-muted-foreground">l{sub.l}</span>
            <button
              type="button"
              onClick={() => onDeleteSub(sub.id)}
              className="text-muted-foreground hover:text-destructive"
              aria-label={`Delete ${sub.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <Input
          placeholder="Add subcategory"
          value={subName}
          onChange={(e) => setSubName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onAddSub(subName, shade);
              setSubName("");
            }
          }}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Shade</span>
          <input
            type="range"
            min={0}
            max={100}
            value={shade}
            onChange={(e) => setShade(Number(e.target.value))}
            className="flex-1"
          />
          <span
            className="timekeeper-swatch"
            style={{ background: subcategoryColor(category.colorId, shade) }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onAddSub(subName, shade);
              setSubName("");
            }}
            disabled={!subName.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
