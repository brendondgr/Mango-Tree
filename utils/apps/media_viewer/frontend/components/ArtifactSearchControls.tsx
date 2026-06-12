import { ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const compact = variant === "compact";

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        compact ? "p-2" : "border-b border-border px-3 py-2",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-sm)] border border-input bg-background px-2 shadow-sm focus-within:ring-2 focus-within:ring-ring",
          compact ? "h-7" : "h-9",
        )}
      >
        <Search
          className={cn(
            "shrink-0 text-muted-foreground",
            compact ? "h-3 w-3" : "h-3.5 w-3.5",
          )}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search artifacts…"
          className={cn(
            "min-w-0 flex-1 border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground",
            compact ? "text-xs" : "text-sm",
          )}
          aria-label="Search artifacts by filename"
        />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "shrink-0 gap-1 border-input bg-background text-foreground",
              compact ? "h-7 px-2 text-xs" : "h-9 px-2.5 text-sm",
            )}
            aria-label="Filter artifacts by type"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <span className="truncate">{typeFilterLabel(typeFilter)}</span>
            <ChevronDown
              className={cn(
                "shrink-0 text-muted-foreground",
                compact ? "h-3 w-3" : "h-3.5 w-3.5",
              )}
              aria-hidden
            />
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
