import { FolderOpen, Loader2 } from "lucide-react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkspaceSidebarShell } from "@/features/workspace/components/WorkspaceSidebarShell";

import { ArtifactGrid } from "@media-viewer/components/ArtifactGrid";
import { ArtifactsSidebarSettings } from "@media-viewer/components/ArtifactsSidebarSettings";
import { useArtifacts } from "@media-viewer/hooks/useArtifacts";

export function ArtifactsSidebar() {
  const { data, isLoading, isError, error } = useArtifacts();

  const artifacts = data?.results ?? [];

  return (
    <WorkspaceSidebarShell>
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/80 px-4 backdrop-blur-sm">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Artifacts
        </h2>
        <ArtifactsSidebarSettings />
      </header>

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

        {!isLoading && !isError && artifacts.length > 0 && (
          <ArtifactGrid artifacts={artifacts} />
        )}
      </ScrollArea>
    </WorkspaceSidebarShell>
  );
}
