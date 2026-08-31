import { ArrowLeft, ChefHat, Plus } from "lucide-react";
import { useState } from "react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { AppHeader } from "@/components/app-shell/AppHeader";
import { Button } from "@/components/ui/button";
import { BrowseView } from "@recipes/components/BrowseView";
import { RecipeDetail } from "@recipes/components/RecipeDetail";
import { RecipeEditor } from "@recipes/components/RecipeEditor";

/**
 * Recipes: browse a pantry-matched grid, read one recipe, or edit one.
 *
 * The header is `AppHeader` rather than a hand-rolled bar, so the title
 * rhythm and the wrapping action row match the other seven app modules. It
 * supplies the pane's `h2`; everything below descends from it without
 * skipping a level.
 */
export function RecipesWorkspace() {
  const view = useWorkspaceStore((s) => s.recipesView);
  const setView = useWorkspaceStore((s) => s.setRecipesView);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const openBrowse = () => setView("browse");
  const openNew = () => {
    setEditingId(null);
    setSelectedId(null);
    setView("editor");
  };
  const openEdit = (id: number) => {
    setEditingId(id);
    setView("editor");
  };
  const afterSave = (id: number) => {
    setEditingId(null);
    setSelectedId(id);
    setView("browse");
  };

  const editing = view === "editor";

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <AppHeader
        icon={ChefHat}
        title="Recipes"
        description={
          editing
            ? editingId != null
              ? "Edit this recipe"
              : "Add a new recipe"
            : "Match recipes to what is in your pantry"
        }
        actions={
          editing ? (
            <Button variant="outline" onClick={openBrowse}>
              <ArrowLeft className="h-4 w-4" />
              Back to browse
            </Button>
          ) : (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" />
              New recipe
            </Button>
          )
        }
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        {editing ? (
          <RecipeEditor recipeId={editingId} onSaved={afterSave} onCancel={openBrowse} />
        ) : selectedId != null ? (
          <RecipeDetail
            recipeId={selectedId}
            onBack={() => setSelectedId(null)}
            onEdit={openEdit}
            onDeleted={() => setSelectedId(null)}
          />
        ) : (
          <BrowseView onSelect={setSelectedId} onCreate={openNew} />
        )}
      </div>
    </div>
  );
}
