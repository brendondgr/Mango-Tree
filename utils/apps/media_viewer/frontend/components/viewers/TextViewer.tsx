import { useEffect, useState } from "react";

import { artifactContentUrl } from "@/services/mediaViewerClient";
import type { ArtifactRecord } from "@/types/mediaViewer";

interface TextViewerProps {
  artifact: ArtifactRecord;
}

export function TextViewer({ artifact }: TextViewerProps) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const language = artifact.metadata.language ?? "plain";

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
            fetchError instanceof Error ? fetchError.message : "Failed to load text",
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
    <div className="h-full overflow-auto p-4">
      <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
        {language}
      </div>
      <pre className="whitespace-pre-wrap break-words rounded-[var(--radius-md)] border border-border bg-muted/30 p-4 font-mono text-sm text-foreground">
        {content}
      </pre>
    </div>
  );
}
