import { LayoutGrid } from "lucide-react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ArtifactsSidebarSettings() {
  const artifactGridColumns = useWorkspaceStore((s) => s.artifactGridColumns);
  const setArtifactGridColumns = useWorkspaceStore((s) => s.setArtifactGridColumns);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label="Artifact grid settings"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Columns per row
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={String(artifactGridColumns)}
          onValueChange={(value) => setArtifactGridColumns(Number(value))}
        >
          {[1, 2, 3, 4, 5].map((count) => (
            <DropdownMenuRadioItem key={count} value={String(count)}>
              {count}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
