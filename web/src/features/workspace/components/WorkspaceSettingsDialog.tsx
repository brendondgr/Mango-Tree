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

type SettingsTab = "llm" | "colors";

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
      <DialogContent className="flex h-[min(90vh,680px)] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 space-y-1 px-5 pb-0 pt-5 pr-12 sm:px-6 sm:pt-6">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            LLM connection and appearance options for this workspace.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as SettingsTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList
            className="h-auto w-full shrink-0 justify-stretch gap-0 border-b border-border px-5 sm:px-6"
            role="tablist"
            aria-label="Settings sections"
          >
            <TabsTrigger value="llm" className="min-w-0 flex-1 rounded-none" role="tab">
              <Settings2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">LLM</span>
            </TabsTrigger>
            <TabsTrigger
              value="colors"
              className="min-w-0 flex-1 rounded-none"
              role="tab"
            >
              <Palette className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Color palette</span>
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="min-h-0 flex-1">
            <TabsContent value="llm" className="px-5 py-4 sm:px-6 sm:py-5" role="tabpanel">
              <LlmConfigPanel active={open && activeTab === "llm"} />
            </TabsContent>
            <TabsContent
              value="colors"
              className="px-5 py-4 sm:px-6 sm:py-5"
              role="tabpanel"
            >
              <ColorPalettePanel />
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
