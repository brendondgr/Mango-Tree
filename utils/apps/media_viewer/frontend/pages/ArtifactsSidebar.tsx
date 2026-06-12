import { FolderOpen } from "lucide-react";

import { WorkspaceSidebarShell } from "@/features/workspace/components/WorkspaceSidebarShell";

export function ArtifactsSidebar() {
  return (
    <WorkspaceSidebarShell>
      <header className="flex h-12 shrink-0 items-center border-b border-border bg-card/80 px-4 backdrop-blur-sm">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Artifacts
        </h2>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
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
    </WorkspaceSidebarShell>
  );
}
