import { FolderOpen, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";

import { ArtifactGrid } from "@media-viewer/components/ArtifactGrid";
import { ArtifactSearchControls } from "@media-viewer/components/ArtifactSearchControls";
import { ArtifactsSidebarSettings } from "@media-viewer/components/ArtifactsSidebarSettings";
import { useArtifacts } from "@media-viewer/hooks/useArtifacts";
import {
  filterArtifacts,
  type ArtifactTypeFilter,
} from "@media-viewer/utils/filterArtifacts";

/**
 * Full-width workspace page for browsing artifacts. Mirrors the artifact
 * sidebar content but renders inside the main workspace body as a tab app,
 * alongside the other apps (Mailbox, Projects, Exercise). Selecting an
 * artifact still opens it in an ephemeral viewer tab.
 */
export function ArtifactsWorkspace() {
  const { data, isLoading, isError, error } = useArtifacts();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ArtifactTypeFilter>("all");

  const artifacts = data?.results ?? [];
  const filteredArtifacts = useMemo(
    () => filterArtifacts(artifacts, { query, typeFilter }),
    [artifacts, query, typeFilter],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Artifacts
        </h2>
        <ArtifactsSidebarSettings />
      </header>

      {!isLoading && !isError && artifacts.length > 0 && (
        <ArtifactSearchControls
          query={query}
          onQueryChange={setQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          variant="full"
        />
      )}

      <ScrollArea className="min-h-0 flex-1">
        {isLoading && (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span className="sr-only">Loading artifacts</span>
          </div>
        )}

        {isError && (
          <div className="space-y-2 p-4 text-sm text-destructive">
            <p>{error instanceof Error ? error.message : "Failed to load artifacts"}</p>
            <p className="text-xs text-muted-foreground">
              Run the Django API in a separate terminal:{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                uv run manage.py runserver
              </code>
            </p>
          </div>
        )}

        {!isLoading && !isError && artifacts.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center text-muted-foreground">
            <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border bg-muted/40">
              <FolderOpen className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">No artifacts yet</p>
              <p className="mt-1 text-xs leading-relaxed">
                Uploads from chat and saved files will appear here.
              </p>
            </div>
          </div>
        )}

        {!isLoading && !isError && artifacts.length > 0 && filteredArtifacts.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No matching artifacts
          </div>
        )}

        {!isLoading && !isError && filteredArtifacts.length > 0 && (
          <ArtifactGrid artifacts={filteredArtifacts} />
        )}
      </ScrollArea>
    </div>
  );
}
