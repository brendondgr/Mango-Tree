import { useQuery } from "@tanstack/react-query";

import { artifactContentUrl, getArtifact } from "@/services/mediaViewerClient";

export function useArtifact(artifactId: string | null) {
  return useQuery({
    queryKey: ["media-viewer", "artifact", artifactId],
    queryFn: () => getArtifact(artifactId!),
    enabled: Boolean(artifactId),
  });
}

/**
 * The text body of a text-shaped artifact (plain text, markdown, LaTeX).
 *
 * The two text viewers each ran their own `fetch` in an effect with no loading
 * flag and no status check, so a 404 rendered the error page's HTML as the
 * document body. One query gives both of them the same loading, error and
 * retry path that every other async surface here uses.
 */
export function useArtifactContent(artifactId: string) {
  return useQuery({
    queryKey: ["media-viewer", "artifact-content", artifactId],
    queryFn: async () => {
      const response = await fetch(artifactContentUrl(artifactId));
      if (!response.ok) {
        throw new Error(`Failed to load content (${response.status})`);
      }
      return response.text();
    },
    // The client default is a 60s staleTime, which is wrong for a file the
    // agent is actively rewriting: the old per-mount fetch always showed the
    // current bytes, and reopening a just-rewritten file should not serve a
    // minute-old body. Cached text still paints instantly; it is just
    // revalidated behind it.
    staleTime: 0,
  });
}
