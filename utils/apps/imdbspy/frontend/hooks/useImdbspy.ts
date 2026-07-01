import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/services/imdbspyClient";
import type { ListParams, MediaStatus, RatingWeights, ReviewInput } from "@/types/imdbspy";

// --- query keys -------------------------------------------------------------

export const IMDBSPY_KEYS = {
  media: (params: ListParams) => ["imdbspy", "media", params] as const,
  weights: ["imdbspy", "weights"] as const,
} as const;

// --- helpers ----------------------------------------------------------------

function useInvalidateMedia() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["imdbspy", "media"] });
  };
}

// --- queries ----------------------------------------------------------------

export function useMedia(params: ListParams = {}) {
  return useQuery({
    queryKey: IMDBSPY_KEYS.media(params),
    queryFn: () => api.listMedia(params),
  });
}

export function useWeights() {
  return useQuery({
    queryKey: IMDBSPY_KEYS.weights,
    queryFn: api.getWeights,
    staleTime: 60_000,
  });
}

// --- mutations --------------------------------------------------------------

export function useAddMedia() {
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: (urls: string[]) => api.addMedia(urls),
    onSuccess: invalidate,
  });
}

export function useRefreshMetadata() {
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: () => api.refreshMetadata(),
    onSuccess: invalidate,
  });
}

export function useSetStatus() {
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: MediaStatus }) =>
      api.setStatus(id, status),
    onSuccess: invalidate,
  });
}

export function useUpdateReview() {
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ReviewInput }) =>
      api.updateReview(id, input),
    onSuccess: invalidate,
  });
}

export function useUpdateSeasons() {
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: ({ id, seasonsSeen }: { id: number; seasonsSeen: number }) =>
      api.updateSeasons(id, seasonsSeen),
    onSuccess: invalidate,
  });
}

export function useDeleteMedia() {
  const invalidate = useInvalidateMedia();
  return useMutation({
    mutationFn: (id: number) => api.deleteMedia(id),
    onSuccess: invalidate,
  });
}

export function useUpdateWeights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weights: Array<Partial<RatingWeights> & { scale_type: string }>) =>
      api.updateWeights(weights),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: IMDBSPY_KEYS.weights });
      // rating values change when weights change
      qc.invalidateQueries({ queryKey: ["imdbspy", "media"] });
    },
  });
}
