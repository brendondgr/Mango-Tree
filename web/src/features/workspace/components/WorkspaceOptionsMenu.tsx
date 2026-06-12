import { MoreVertical, Settings2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LlmConfigDialog } from "@/features/workspace/components/LlmConfigDialog";
import { cn } from "@/lib/utils";

interface WorkspaceOptionsMenuProps {
  className?: string;
}

export function WorkspaceOptionsMenu({ className }: WorkspaceOptionsMenuProps) {
  const [llmDialogOpen, setLlmDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className={cn("h-11 w-11", className)}
            aria-label="Workspace options"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setLlmDialogOpen(true)}>
            <Settings2 className="h-4 w-4" />
            LLM settings…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LlmConfigDialog open={llmDialogOpen} onOpenChange={setLlmDialogOpen} />
    </>
  );
}
