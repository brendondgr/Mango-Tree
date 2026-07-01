import { useState } from "react";
import { ChefHat, Plus } from "lucide-react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import { BrowseView } from "@recipes/components/BrowseView";
import { RecipeDetail } from "@recipes/components/RecipeDetail";
import { RecipeEditor } from "@recipes/components/RecipeEditor";

import "@recipes/styles/recipes.css";

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

  return (
    <div className="recipes-app flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <ChefHat className="h-5 w-5 text-primary" />
          Recipes
        </div>
        <div className="ml-auto flex items-center gap-2">
          {view === "editor" ? (
            <Button size="sm" variant="outline" onClick={openBrowse}>
              Back to Browse
            </Button>
          ) : (
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              New Recipe
            </Button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {view === "editor" ? (
          <RecipeEditor recipeId={editingId} onSaved={afterSave} onCancel={openBrowse} />
        ) : selectedId != null ? (
          <RecipeDetail
            recipeId={selectedId}
            onBack={() => setSelectedId(null)}
            onEdit={openEdit}
            onDeleted={() => setSelectedId(null)}
          />
        ) : (
          <BrowseView onSelect={setSelectedId} />
        )}
      </div>
    </div>
  );
}
