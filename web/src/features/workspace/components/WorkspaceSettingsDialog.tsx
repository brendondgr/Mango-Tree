import { ArrowLeft, Palette, Settings2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ColorPalettePanel } from "@/features/workspace/components/ColorPalettePanel";
import { LlmConfigDialog } from "@/features/workspace/components/LlmConfigDialog";
import { cn } from "@/lib/utils";

type SettingsPage = "menu" | "llm" | "colors";

interface WorkspaceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MENU_ITEMS = [
  {
    id: "llm" as const,
    label: "LLM settings",
    description: "Endpoint, model, and API key",
    icon: Settings2,
  },
  {
    id: "colors" as const,
    label: "Color palettes",
    description: "Themes, presets, and custom colors",
    icon: Palette,
  },
];

export function WorkspaceSettingsDialog({
  open,
  onOpenChange,
}: WorkspaceSettingsDialogProps) {
  const [page, setPage] = useState<SettingsPage>("menu");

  const handleOpenChange = (next: boolean) => {
    if (!next) setPage("menu");
    onOpenChange(next);
  };

  if (page === "llm") {
    return (
      <LlmConfigDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setPage("menu");
            onOpenChange(false);
            return;
          }
          onOpenChange(next);
        }}
        onBack={() => setPage("menu")}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[min(90vh,720px)] overflow-y-auto",
          page === "colors" ? "max-w-2xl" : "max-w-md",
        )}
      >
        {page === "menu" ? (
          <>
            <DialogHeader>
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>
                Workspace options for chat and appearance.
              </DialogDescription>
            </DialogHeader>

            <nav className="grid gap-2 py-2" aria-label="Settings sections">
              {MENU_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPage(item.id)}
                    className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-border px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block font-medium">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setPage("menu")}
                  aria-label="Back to settings menu"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <DialogTitle>Color palettes</DialogTitle>
                  <DialogDescription>
                    Browse presets or fine-tune individual colors.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <ColorPalettePanel />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
