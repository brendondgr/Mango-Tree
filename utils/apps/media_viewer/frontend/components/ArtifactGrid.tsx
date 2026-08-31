import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import { useIsNarrowPane } from "@/components/app-shell/MasterDetail";
import type { ArtifactRecord } from "@/types/mediaViewer";

import { ArtifactTile } from "./ArtifactTile";

/**
 * The column count is a user preference, but it is chosen for a wide pane.
 * Dragging the chat sidebar open can leave a five-column grid with ~120px
 * tiles whose filename and actions no longer fit, so the pane's own width —
 * not the viewport — caps it. The stored preference is untouched.
 *
 * Exported so the loading skeleton lays out the same grid the real one will:
 * painting the stored five columns and then snapping to two is a worse first
 * frame than never showing five at all.
 */
export function paneArtifactColumns(columns: number, isNarrow: boolean): number {
  return isNarrow ? Math.min(columns, 2) : columns;
}

interface ArtifactGridProps {
  artifacts: ArtifactRecord[];
}

export function ArtifactGrid({ artifacts }: ArtifactGridProps) {
  const columns = useWorkspaceStore((s) => s.artifactGridColumns);
  const [paneRef, isNarrow] = useIsNarrowPane<HTMLDivElement>();

  const effectiveColumns = paneArtifactColumns(columns, isNarrow);

  return (
    <div
      ref={paneRef}
      // Focusable only programmatically: a tile deleted from its own Trash
      // button takes that button out of the document, and the container is
      // what focus falls back to.
      tabIndex={-1}
      className="grid gap-2 p-2 outline-none"
      style={{
        gridTemplateColumns: `repeat(${effectiveColumns}, minmax(0, 1fr))`,
      }}
    >
      {artifacts.map((artifact, index) => (
        <ArtifactTile
          key={artifact.id}
          artifact={artifact}
          index={index}
          returnFocusRef={paneRef}
        />
      ))}
    </div>
  );
}
