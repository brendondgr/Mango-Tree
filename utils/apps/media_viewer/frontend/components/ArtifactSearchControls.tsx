import { ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { ArtifactTypeFilter } from "@media-viewer/utils/filterArtifacts";

interface ArtifactSearchControlsProps {
  query: string;
  onQueryChange: (query: string) => void;
  typeFilter: ArtifactTypeFilter;
  onTypeFilterChange: (filter: ArtifactTypeFilter) => void;
  variant?: "full" | "compact";
}

const TYPE_OPTIONS: { value: ArtifactTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "documents", label: "Documents" },
  { value: "images", label: "Images" },
  { value: "videos", label: "Videos" },
];

function typeFilterLabel(filter: ArtifactTypeFilter): string {
  return TYPE_OPTIONS.find((option) => option.value === filter)?.label ?? "All";
}

export function ArtifactSearchControls({
  query,
  onQueryChange,
  typeFilter,
  onTypeFilterChange,
  variant = "full",
}: ArtifactSearchControlsProps) {
  // `compact` is the in-composer placement. It now only changes the surrounding
  // chrome: the control heights come from the primitives, which are already
  // 44px on compact and 36px at the shell breakpoint, so both placements clear
  // the touch minimum without a bespoke height in this file.
  const compact = variant === "compact";

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        compact ? "p-2" : "border-b border-border px-3 py-2",
      )}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search artifacts…"
          className="pl-9"
          aria-label="Search artifacts by filename"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-1 px-3"
            aria-label={`Filter artifacts by type, currently ${typeFilterLabel(typeFilter)}`}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span className="truncate">{typeFilterLabel(typeFilter)}</span>
            <ChevronDown className="text-muted-foreground" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-36"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <DropdownMenuRadioGroup
            value={typeFilter}
            onValueChange={(value) =>
              onTypeFilterChange(value as ArtifactTypeFilter)
            }
          >
            {TYPE_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
