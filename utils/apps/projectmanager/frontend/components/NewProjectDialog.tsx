import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AlertCircle, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  SelectField,
  selectFieldTriggerProps,
  useFormErrors,
  useSelectFieldIds,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_COLORS } from "@/types/projectmanager";
import { CategoryBadge } from "@projectmanager/components/CategoryBadge";
import { TEXTAREA_CLASS } from "@projectmanager/utils/classes";
import { categoryAccent } from "@projectmanager/utils/colors";
import {
  useCategories,
  useCreateProject,
} from "@projectmanager/hooks/useProjectManager";

/** Sentinel choice meaning "type a name for a category that does not exist yet". */
const NEW_CATEGORY = "__new__";

function colorLabel(color: string): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Create a project.
 *
 * The category control used to be a text input with a floating suggestion list
 * that committed on `onMouseDown`: a keyboard user could reach a suggestion and
 * pressing Enter did nothing, so every existing category was mouse-only. The
 * list also had no close path, so it sat on top of the colour swatches for the
 * rest of the dialog's life. It is now a `Select` — real listbox semantics,
 * typeahead, Escape to close, portalled above the rest of the form — with a
 * "New category" choice that reveals the free-text name field. The payload sent
 * to the API is unchanged: a `category_name` string plus a `category_color`.
 */
export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const create = useCreateProject();
  const categories = useCategories();
  const formRef = useRef<HTMLFormElement>(null);
  const categoryIds = useSelectFieldIds();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [categoryChoice, setCategoryChoice] = useState<string>(NEW_CATEGORY);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState<string>("blue");

  const {
    errors,
    formError,
    setFormError,
    setFieldError,
    clearFieldError,
    clear,
    focusFirstError,
  } = useFormErrors<"title" | "category">();

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setDeadline("");
    setCategoryChoice(NEW_CATEGORY);
    setCategoryName("");
    setCategoryColor("blue");
    clear();
  }, [open, clear]);

  // One entry per distinct category name — the API can return the same name
  // more than once and Radix requires unique, non-empty item values.
  const existingCats = useMemo(() => {
    const seen = new Map<string, { name: string; color: string }>();
    for (const cat of categories.data ?? []) {
      if (cat.name && cat.name !== NEW_CATEGORY && !seen.has(cat.name)) {
        seen.set(cat.name, { name: cat.name, color: cat.color });
      }
    }
    return [...seen.values()];
  }, [categories.data]);

  const creatingNew = categoryChoice === NEW_CATEGORY;
  const effectiveName = creatingNew ? categoryName : categoryChoice;

  const handleCategoryChoice = (choice: string) => {
    clearFieldError("category");
    setCategoryChoice(choice);
    if (choice === NEW_CATEGORY) {
      setCategoryName("");
      return;
    }
    const picked = existingCats.find((c) => c.name === choice);
    if (picked) setCategoryColor(picked.color);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    clear();

    let invalid = false;
    if (!title.trim()) {
      setFieldError("title", "Give the project a title.");
      invalid = true;
    }
    if (!effectiveName.trim()) {
      setFieldError("category", "Pick a category or name a new one.");
      invalid = true;
    }
    if (invalid) {
      // Deferred so the freshly rendered aria-invalid control is the one found.
      requestAnimationFrame(() => focusFirstError(formRef.current));
      return;
    }

    create.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        category_name: effectiveName.trim(),
        category_color: categoryColor,
        deadline: deadline || null,
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setFormError((err as Error).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Create a project and track it on the board.
          </DialogDescription>
        </DialogHeader>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <DialogBody className="space-y-4">
            <Field
              label="Title"
              required
              error={errors.title}
              hint="Shown on the board card."
            >
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearFieldError("title");
                }}
                placeholder="e.g. Website Redesign"
                autoFocus
              />
            </Field>

            <Field label="Description">
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief details…"
                className={TEXTAREA_CLASS}
              />
            </Field>

            <Field label="Deadline" hint="Optional.">
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </Field>

            <SelectField
              label="Category"
              required
              ids={categoryIds}
              error={creatingNew ? undefined : errors.category}
            >
              <Select
                value={categoryChoice}
                onValueChange={handleCategoryChoice}
              >
                <SelectTrigger
                  {...selectFieldTriggerProps(
                    categoryIds,
                    creatingNew ? undefined : errors.category,
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NEW_CATEGORY}>New category…</SelectItem>
                  {/* Without these two rows the list reads as "there are no
                      categories yet" while the request is still in flight, and
                      again after it fails — so the user names a duplicate of a
                      category that already exists. Error beats loading, the
                      same precedence AsyncBoundary uses. */}
                  {categories.error != null ? (
                    <p className="px-2 py-1.5 text-xs text-destructive">
                      Existing categories could not be loaded. You can still
                      name a new one.
                    </p>
                  ) : categories.isLoading ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      Loading categories…
                    </p>
                  ) : null}
                  {existingCats.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          style={categoryAccent(cat.color)}
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-[hsl(var(--pm-accent))]"
                        />
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SelectField>

            {creatingNew && (
              <Field label="New category name" required error={errors.category}>
                <Input
                  value={categoryName}
                  onChange={(e) => {
                    setCategoryName(e.target.value);
                    clearFieldError("category");
                  }}
                  placeholder="e.g. Client work"
                  autoComplete="off"
                />
              </Field>
            )}

            {/* Colour: a real radio group, so arrow keys move between swatches
                and the whole group is a single tab stop. */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium leading-none text-foreground">
                Colour
              </legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map((color) => (
                  <label key={color} className="cursor-pointer">
                    <input
                      type="radio"
                      name="projectmanager-category-colour"
                      value={color}
                      checked={categoryColor === color}
                      onChange={() => setCategoryColor(color)}
                      className="peer sr-only"
                    />
                    <span className="sr-only">{colorLabel(color)}</span>
                    <span
                      aria-hidden
                      style={categoryAccent(color)}
                      className={[
                        "flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)]",
                        "border border-border bg-surface-2 transition-colors app:h-9 app:w-9",
                        "peer-checked:border-foreground peer-checked:ring-2 peer-checked:ring-foreground",
                        "peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                      ].join(" ")}
                    >
                      <span className="h-5 w-5 rounded-full bg-[hsl(var(--pm-accent))]" />
                    </span>
                  </label>
                ))}
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                Preview:
                <CategoryBadge
                  name={effectiveName || "Category"}
                  color={categoryColor}
                />
              </p>
            </fieldset>

            {formError && (
              <p
                role="alert"
                className="flex items-start gap-1.5 text-sm font-medium text-destructive"
              >
                <AlertCircle className="mt-px h-4 w-4 shrink-0" aria-hidden />
                <span>{formError}</span>
              </p>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              <Plus />
              {create.isPending ? "Creating…" : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
