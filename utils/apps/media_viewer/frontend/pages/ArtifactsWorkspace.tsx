import { FolderOpen, SearchX } from "lucide-react";
import { useMemo, useState } from "react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { AppHeader } from "@/components/app-shell/AppHeader";
import { useIsNarrowPane } from "@/components/app-shell/MasterDetail";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

import {
  ArtifactGrid,
  paneArtifactColumns,
} from "@media-viewer/components/ArtifactGrid";
import { ArtifactSearchControls } from "@media-viewer/components/ArtifactSearchControls";
import { ArtifactsSidebarSettings } from "@media-viewer/components/ArtifactsSidebarSettings";
import { useArtifacts } from "@media-viewer/hooks/useArtifacts";
import {
  filterArtifacts,
  type ArtifactTypeFilter,
} from "@media-viewer/utils/filterArtifacts";

/** Placeholder shaped like the real tile: 64px thumbnail, then two text lines. */
function ArtifactGridSkeleton({ columns }: { columns: number }) {
  // The real grid caps the stored preference against its own width, so the
  // skeleton has to measure the same way. Reading the raw preference painted
  // five ~70px tiles in a narrow pane and then snapped to two the moment the
  // data landed.
  const [paneRef, isNarrow] = useIsNarrowPane<HTMLDivElement>();
  const effectiveColumns = paneArtifactColumns(columns, isNarrow);

  return (
    <div
      ref={paneRef}
      className="grid gap-2 p-2"
      style={{
        gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))`,
      }}
    >
      {Array.from({ length: effectiveColumns * 2 }, (_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-[var(--radius-sm)] border border-border bg-card"
        >
          <Skeleton className="h-16 w-full rounded-none" />
          <div className="space-y-1.5 p-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Full-width workspace page for browsing artifacts. Mirrors the artifact
 * sidebar content but renders inside the main workspace body as a tab app,
 * alongside the other apps (Mailbox, Projects, Exercise). Selecting an
 * artifact still opens it in an ephemeral viewer tab.
 */
export function ArtifactsWorkspace() {
  const { data, isLoading, isError, error, refetch } = useArtifacts();
  const columns = useWorkspaceStore((s) => s.artifactGridColumns);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ArtifactTypeFilter>("all");

  const artifacts = data?.results ?? [];
  const filteredArtifacts = useMemo(
    () => filterArtifacts(artifacts, { query, typeFilter }),
    [artifacts, query, typeFilter],
  );

  const isFiltered = query.trim() !== "" || typeFilter !== "all";
  const showControls = !isLoading && !isError && artifacts.length > 0;

  // The original error branch carried a "run the Django API" hint that a bare
  // message would lose, so it travels with the message instead of vanishing.
  const errorText = isError
    ? `${
        error instanceof Error ? error.message : "Failed to load artifacts"
      } — check that the API server is running (uv run manage.py runserver).`
    : undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <AppHeader
        icon={FolderOpen}
        title="Artifacts"
        description={
          showControls
            ? isFiltered
              ? `${filteredArtifacts.length} of ${artifacts.length} files`
              : `${artifacts.length} ${artifacts.length === 1 ? "file" : "files"}`
            : undefined
        }
        actions={<ArtifactsSidebarSettings />}
      />

      {showControls && (
        <ArtifactSearchControls
          query={query}
          onQueryChange={setQuery}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          variant="full"
        />
      )}

      <ScrollArea className="min-h-0 flex-1">
        <AsyncBoundary
          label="artifacts"
          loading={isLoading}
          error={errorText}
          onRetry={() => void refetch()}
          empty={artifacts.length === 0}
          emptyIcon={FolderOpen}
          emptyTitle="No artifacts yet"
          emptyDescription="Uploads from chat and files saved by the agent appear here."
          skeleton={<ArtifactGridSkeleton columns={columns} />}
        >
          {filteredArtifacts.length === 0 ? (
            <EmptyState
              compact
              icon={SearchX}
              title="No matching artifacts"
              description="No file matches this search and type filter."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setTypeFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <ArtifactGrid artifacts={filteredArtifacts} />
          )}
        </AsyncBoundary>
      </ScrollArea>
    </div>
  );
}
