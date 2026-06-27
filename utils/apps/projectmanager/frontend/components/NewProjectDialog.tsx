import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_COLORS } from "@/types/projectmanager";
import { categoryClass } from "@projectmanager/utils/colors";
import { useCategories, useCreateProject } from "@projectmanager/hooks/useProjectManager";

/** Swatch background colours for the colour picker grid. */
const SWATCH_BG: Record<string, string> = {
  blue:   "#3b82f6",
  green:  "#10b981",
  purple: "#a855f7",
  orange: "#f97316",
  red:    "#ef4444",
  teal:   "#14b8a6",
  yellow: "#eab308",
  pink:   "#f472b6",
};

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const create = useCreateProject();
  const categories = useCategories();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState<string>("blue");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setDeadline("");
    setCategoryName("");
    setCategoryColor("blue");
    setShowSuggestions(false);
    setError(null);
  }, [open]);

  const existingCats = categories.data ?? [];
  const filteredCats = categoryName.trim()
    ? existingCats.filter((c) =>
        c.name.toLowerCase().includes(categoryName.trim().toLowerCase())
      )
    : existingCats;

  const handlePickCategory = (name: string, color: string) => {
    setCategoryName(name);
    setCategoryColor(color);
    setShowSuggestions(false);
  };

  const handleSubmit = () => {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!categoryName.trim()) {
      setError("Category name is required.");
      return;
    }
    create.mutate(
      {
        title: title.trim(),
        description: description.trim() || null,
        category_name: categoryName.trim(),
        category_color: categoryColor,
        deadline: deadline || null,
      },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setError((err as Error).message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="projectmanager-app max-w-md">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>
            Create a project and track it on the board.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="pm-title">Title *</Label>
            <Input
              id="pm-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Website Redesign"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="pm-desc">Description</Label>
            <textarea
              id="pm-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief details…"
              className="projectmanager-input resize-none"
            />
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <Label htmlFor="pm-deadline">Deadline (optional)</Label>
            <Input
              id="pm-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {/* Category name with quick-pick */}
          <div className="space-y-2">
            <Label htmlFor="pm-cat-name">Category Name *</Label>
            <div className="relative">
              <Input
                id="pm-cat-name"
                value={categoryName}
                onChange={(e) => {
                  setCategoryName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Type or pick existing…"
                autoComplete="off"
              />
              {showSuggestions && filteredCats.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-[var(--radius-md)] border border-border bg-popover shadow-lg overflow-hidden">
                  {filteredCats.slice(0, 8).map((cat) => (
                    <button
                      key={`${cat.id}-${cat.name}`}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handlePickCategory(cat.name, cat.color);
                      }}
                    >
                      <span className={categoryClass(cat.color)}>{cat.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Category colour swatch grid */}
          <div className="space-y-2">
            <Label>Colour</Label>
            <div className="projectmanager-swatch-grid">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  className="projectmanager-swatch"
                  data-selected={categoryColor === c}
                  style={{ background: SWATCH_BG[c] }}
                  onClick={() => setCategoryColor(c)}
                />
              ))}
            </div>
            {/* Live preview of the badge */}
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              Preview:
              <span className={categoryClass(categoryColor)}>
                {categoryName || "Category"}
              </span>
            </p>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
