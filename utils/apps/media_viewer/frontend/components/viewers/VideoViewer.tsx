import { artifactContentUrl } from "@/services/mediaViewerClient";
import type { ArtifactRecord } from "@/types/mediaViewer";

interface VideoViewerProps {
  artifact: ArtifactRecord;
}

export function VideoViewer({ artifact }: VideoViewerProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden bg-black p-4">
      <video
        src={artifactContentUrl(artifact.id)}
        controls
        className="max-h-full max-w-full object-contain"
        aria-label={artifact.filename}
      >
        <track kind="captions" />
      </video>
    </div>
  );
}
