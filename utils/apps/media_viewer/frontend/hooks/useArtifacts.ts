import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteArtifact,
  listArtifacts,
} from "@/services/mediaViewerClient";

export const ARTIFACTS_QUERY_KEY = ["media-viewer", "artifacts"] as const;

export function useArtifacts() {
  return useQuery({
    queryKey: ARTIFACTS_QUERY_KEY,
    queryFn: () => listArtifacts({ limit: 100 }),
  });
}

export function useDeleteArtifact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (artifactId: string) => deleteArtifact(artifactId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ARTIFACTS_QUERY_KEY });
    },
  });
}
