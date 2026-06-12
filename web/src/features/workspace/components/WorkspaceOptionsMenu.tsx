import { Settings } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { WorkspaceSettingsDialog } from "@/features/workspace/components/WorkspaceSettingsDialog";
import { cn } from "@/lib/utils";

interface WorkspaceOptionsMenuProps {
  className?: string;
}

export function WorkspaceOptionsMenu({ className }: WorkspaceOptionsMenuProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className={cn("h-11 w-11", className)}
        aria-label="Open settings"
        onClick={() => setSettingsOpen(true)}
      >
        <Settings className="h-4 w-4" />
      </Button>

      <WorkspaceSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </>
  );
}
