import { useRef, useState } from "react";
import { Check, Plus, Tags, Trash2 } from "lucide-react";

import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SkeletonCard } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Category } from "@/types/timekeeper";

import { useCategories, useSaveCategories } from "@timekeeper/hooks/useTimekeeper";
import { COLOR_IDS, categoryColor, subcategoryColor } from "@timekeeper/utils/colors";

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function CategoriesView() {
  const categoriesQuery = useCategories();
  const categories = categoriesQuery.data ?? [];
  const save = useSaveCategories();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_IDS[0]);
  const nameRef = useRef<HTMLInputElement>(null);
  const colorRefs = useRef(new Map<string, HTMLButtonElement>());

  // A radio group is one tab stop with arrow keys inside it, not eight stops.
  function onColorKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const current = COLOR_IDS.indexOf(newColor);
    if (current === -1) return;
    let next = current;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      next = (current + 1) % COLOR_IDS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      next = (current - 1 + COLOR_IDS.length) % COLOR_IDS.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = COLOR_IDS.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const colorId = COLOR_IDS[next];
    setNewColor(colorId);
    colorRefs.current.get(colorId)?.focus();
  }

  function commit(next: Category[]) {
    save.mutate(next);
  }

  function addCategory() {
    const name = newName.trim();
    if (!name) return;
    commit([...categories, { id: genId("cat"), name, colorId: newColor, subcategories: [] }]);
    setNewName("");
  }

  function deleteCategory(id: string) {
    commit(categories.filter((category) => category.id !== id));
  }

  function addSubcategory(catId: string, name: string, l: number) {
    if (!name.trim()) return;
    commit(
      categories.map((category) =>
        category.id === catId
          ? {
              ...category,
              subcategories: [
                ...category.subcategories,
                { id: genId("sub"), name: name.trim(), l },
              ],
            }
          : category,
      ),
    );
  }

  function deleteSubcategory(catId: string, subId: string) {
    commit(
      categories.map((category) =>
        category.id === catId
          ? {
              ...category,
              subcategories: category.subcategories.filter((sub) => sub.id !== subId),
            }
          : category,
      ),
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 @[34rem]:p-4 @[60rem]:p-6">
      <section
        aria-label="Add a category"
        className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-3 shadow-xs @[34rem]:p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label="New category name" className="min-w-[13rem] flex-1">
            <Input
              ref={nameRef}
              placeholder="Deep work, Errands, Sleep…"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && addCategory()}
            />
          </Field>
          <Button onClick={addCategory} disabled={!newName.trim() || save.isPending}>
            <Plus className="h-4 w-4" aria-hidden />
            Add category
          </Button>
        </div>

        <div
          role="radiogroup"
          aria-label="Category colour"
          onKeyDown={onColorKeyDown}
          className="flex flex-wrap gap-2"
        >
          {COLOR_IDS.map((colorId) => {
            const selected = newColor === colorId;
            return (
              <button
                key={colorId}
                ref={(node) => {
                  if (node) colorRefs.current.set(colorId, node);
                  else colorRefs.current.delete(colorId);
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${colorId} colour`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setNewColor(colorId)}
                className={cn(
                  "relative h-11 w-11 rounded-[var(--radius-md)] border border-border/60 @[34rem]:h-9 @[34rem]:w-9",
                  "transition-shadow focus-visible:[outline-offset:2px]",
                  selected && "ring-2 ring-ring ring-offset-2 ring-offset-card",
                )}
                style={{ background: categoryColor(colorId) }}
              >
                {selected && (
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-card text-foreground shadow-xs"
                  >
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {save.isError && (
          <p role="alert" className="text-sm text-destructive">
            {(save.error as Error).message}
          </p>
        )}
      </section>

      <AsyncBoundary
        loading={categoriesQuery.isLoading}
        error={categoriesQuery.error}
        empty={categories.length === 0}
        onRetry={() => void categoriesQuery.refetch()}
        label="categories"
        skeleton={
          <div className="grid grid-cols-1 gap-4 @[38rem]:grid-cols-2 @[62rem]:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        }
        emptyIcon={Tags}
        emptyTitle="No categories yet"
        emptyDescription="A category fixes a hue; each subcategory under it is a shade of that hue, and those shades are what you paint the day with."
        emptyAction={
          <Button variant="outline" onClick={() => nameRef.current?.focus()}>
            Name your first category
          </Button>
        }
        className="rounded-[var(--radius-lg)] border border-border bg-card shadow-xs"
      >
        <ul className="grid grid-cols-1 gap-4 @[38rem]:grid-cols-2 @[62rem]:grid-cols-3">
          {categories.map((category, index) => (
            <li key={category.id} data-enter style={{ "--i": index } as never}>
              <CategoryCard
                category={category}
                busy={save.isPending}
                onDelete={() => deleteCategory(category.id)}
                onAddSub={(name, l) => addSubcategory(category.id, name, l)}
                onDeleteSub={(subId) => deleteSubcategory(category.id, subId)}
              />
            </li>
          ))}
        </ul>
      </AsyncBoundary>
    </div>
  );
}

function CategoryCard({
  category,
  busy,
  onDelete,
  onAddSub,
  onDeleteSub,
}: {
  category: Category;
  busy: boolean;
  onDelete: () => void;
  onAddSub: (name: string, l: number) => void;
  onDeleteSub: (subId: string) => void;
}) {
  const [subName, setSubName] = useState("");
  const [shade, setShade] = useState(50);

  function submitSub() {
    if (!subName.trim()) return;
    onAddSub(subName, shade);
    setSubName("");
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-3 shadow-xs @[34rem]:p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold">
          <span
            aria-hidden
            className="h-4 w-4 shrink-0 rounded-[var(--radius-sm)] border border-border/50"
            style={{ background: categoryColor(category.colorId) }}
          />
          <span className="truncate">{category.name}</span>
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={busy}
          aria-label={`Delete the ${category.name} category`}
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {category.subcategories.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No subcategories yet — add one below to paint with this colour.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {category.subcategories.map((sub) => (
            <li key={sub.id} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 rounded-[var(--radius-sm)] border border-border/50"
                style={{ background: subcategoryColor(category.colorId, sub.l) }}
              />
              <span className="min-w-0 flex-1 truncate">{sub.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                shade {sub.l}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDeleteSub(sub.id)}
                disabled={busy}
                aria-label={`Delete the ${sub.name} subcategory`}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-col gap-3 border-t border-border pt-3">
        <Field label={`Add a subcategory to ${category.name}`} hideLabel>
          <Input
            placeholder="Add subcategory"
            value={subName}
            onChange={(event) => setSubName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSub();
            }}
          />
        </Field>

        <div className="flex items-end gap-2">
          <Field label="Shade" hint={`Level ${shade}`} className="min-w-0 flex-1">
            <input
              type="range"
              min={0}
              max={100}
              value={shade}
              onChange={(event) => setShade(Number(event.target.value))}
              className="h-11 w-full cursor-pointer accent-primary @[34rem]:h-9"
            />
          </Field>
          <span
            aria-hidden
            className="mb-1 h-6 w-6 shrink-0 rounded-[var(--radius-sm)] border border-border/50"
            style={{ background: subcategoryColor(category.colorId, shade) }}
          />
          <Button
            variant="outline"
            size="icon"
            className="mb-1"
            onClick={submitSub}
            disabled={!subName.trim() || busy}
            aria-label={`Add subcategory to ${category.name}`}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
