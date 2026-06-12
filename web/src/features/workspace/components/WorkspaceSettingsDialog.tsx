import { Palette, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColorPalettePanel } from "@/features/workspace/components/ColorPalettePanel";
import { LlmConfigPanel } from "@/features/workspace/components/LlmConfigPanel";
import { cn } from "@/lib/utils";

type SettingsTab = "llm" | "colors";

const settingsTabTriggerClass = cn(
  "min-w-0 justify-start gap-2 rounded-none px-3 py-2",
  "flex-1 border-b-2 border-l-0 border-transparent data-[state=active]:border-b-primary data-[state=active]:border-l-transparent",
  "sm:flex-none sm:flex-initial sm:border-b-0 sm:border-l-2 sm:data-[state=active]:border-b-transparent sm:data-[state=active]:border-l-primary",
);

interface WorkspaceSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceSettingsDialog({
  open,
  onOpenChange,
}: WorkspaceSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("llm");

  useEffect(() => {
    if (open) setActiveTab("llm");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(90vh,720px)] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 px-5 pb-0 pt-5 pr-12 sm:px-6 sm:pt-6">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            LLM connection and appearance options for this workspace.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as SettingsTab)}
          className="flex min-h-0 flex-1 flex-col sm:flex-row"
        >
          <TabsList
            className="h-auto w-full shrink-0 justify-stretch gap-1 border-b border-border bg-transparent px-5 py-2 sm:w-44 sm:flex-col sm:items-stretch sm:border-b-0 sm:border-r sm:px-3 sm:py-4"
            role="tablist"
            aria-label="Settings sections"
          >
            <TabsTrigger value="llm" className={settingsTabTriggerClass} role="tab">
              <Settings2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">LLM</span>
            </TabsTrigger>
            <TabsTrigger value="colors" className={settingsTabTriggerClass} role="tab">
              <Palette className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Color palette</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {activeTab === "llm" ? (
              <ScrollArea className="min-h-0 flex-1">
                <TabsContent
                  value="llm"
                  className="px-5 py-4 sm:px-6 sm:py-5"
                  role="tabpanel"
                  forceMount
                >
                  <LlmConfigPanel active={open && activeTab === "llm"} />
                </TabsContent>
              </ScrollArea>
            ) : (
              <TabsContent
                value="colors"
                className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4 sm:px-6 sm:py-5"
                role="tabpanel"
                forceMount
              >
                <ColorPalettePanel />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
