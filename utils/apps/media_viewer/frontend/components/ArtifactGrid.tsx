import { useWorkspaceStore } from "@/app/stores/workspaceStore";
import type { ArtifactRecord } from "@/types/mediaViewer";

import { ArtifactTile } from "./ArtifactTile";

interface ArtifactGridProps {
  artifacts: ArtifactRecord[];
  onDelete: (artifact: ArtifactRecord) => void;
}

export function ArtifactGrid({ artifacts, onDelete }: ArtifactGridProps) {
  const columns = useWorkspaceStore((s) => s.artifactGridColumns);

  return (
    <div
      className="grid gap-2 p-2"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {artifacts.map((artifact) => (
        <ArtifactTile
          key={artifact.id}
          artifact={artifact}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
