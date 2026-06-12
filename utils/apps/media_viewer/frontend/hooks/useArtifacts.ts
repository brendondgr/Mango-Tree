import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { useWorkspaceStore } from "@/app/stores/workspaceStore";
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

export function useArtifactDeleteFlow(artifactId: string) {
  const ephemeralTab = useWorkspaceStore((s) => s.ephemeralTab);
  const setPinnedTab = useWorkspaceStore((s) => s.setPinnedTab);
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const deleteMutation = useDeleteArtifact();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = useCallback(() => {
    deleteMutation.mutate(artifactId, {
      onSuccess: () => {
        if (ephemeralTab?.artifactId === artifactId) {
          setPinnedTab(activeTab);
        }
        setConfirmDelete(false);
      },
    });
  }, [
    activeTab,
    artifactId,
    deleteMutation,
    ephemeralTab?.artifactId,
    setPinnedTab,
  ]);

  return {
    confirmDelete,
    requestDelete: () => setConfirmDelete(true),
    cancelDelete: () => setConfirmDelete(false),
    handleDelete,
    isPending: deleteMutation.isPending,
  };
}
