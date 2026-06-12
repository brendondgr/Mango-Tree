import { Search } from "lucide-react";

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
      <div className="relative min-w-0 flex-1">
        <Search
          className={cn(
            "pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground",
            compact ? "h-3 w-3" : "h-3.5 w-3.5",
          )}
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search artifacts…"
          className={cn(
            "pl-7",
            compact && "h-7 text-xs",
          )}
          aria-label="Search artifacts by filename"
        />
      </div>
      <select
        value={typeFilter}
        onChange={(event) =>
          onTypeFilterChange(event.target.value as ArtifactTypeFilter)
        }
        className={cn(
          "shrink-0 rounded-[var(--radius-sm)] border border-input bg-transparent text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "h-7 px-1.5 text-xs" : "h-9 px-2 text-sm",
        )}
        aria-label="Filter artifacts by type"
      >
        {TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
