import { useQuery } from "@tanstack/react-query";

import { getArtifact } from "@/services/mediaViewerClient";

export function useArtifact(artifactId: string | null) {
  return useQuery({
    queryKey: ["media-viewer", "artifact", artifactId],
    queryFn: () => getArtifact(artifactId!),
    enabled: Boolean(artifactId),
  });
}
