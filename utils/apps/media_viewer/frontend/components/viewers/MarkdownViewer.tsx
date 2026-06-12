import { useEffect, useState } from "react";

import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { artifactContentUrl } from "@/services/mediaViewerClient";
import type { ArtifactRecord } from "@/types/mediaViewer";

interface MarkdownViewerProps {
  artifact: ArtifactRecord;
}

export function MarkdownViewer({ artifact }: MarkdownViewerProps) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(artifactContentUrl(artifact.id))
      .then((response) => response.text())
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load markdown",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [artifact.id]);

  if (error) {
    return <p className="p-6 text-sm text-destructive">{error}</p>;
  }

  return (
    <div className="h-full min-h-0 flex-1 overflow-auto p-6">
      <MarkdownContent content={content} />
    </div>
  );
}
