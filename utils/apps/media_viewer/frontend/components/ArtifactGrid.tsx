import type { ArtifactRecord } from "@/types/mediaViewer";

import { ArtifactTile } from "./ArtifactTile";

interface ArtifactGridProps {
  artifacts: ArtifactRecord[];
  onDelete: (artifact: ArtifactRecord) => void;
}

export function ArtifactGrid({ artifacts, onDelete }: ArtifactGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
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
