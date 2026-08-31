import { FileText } from "lucide-react";

import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import type { ArtifactRecord } from "@/types/mediaViewer";

import { useArtifactContent } from "@media-viewer/hooks/useArtifactViewer";

interface TextViewerProps {
  artifact: ArtifactRecord;
}

function TextSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-16" />
      <div className="space-y-2 rounded-[var(--radius-md)] border border-border p-4">
        {["w-11/12", "w-4/5", "w-full", "w-3/5", "w-10/12", "w-2/5"].map(
          (width) => (
            <Skeleton key={width} className={`h-3 ${width}`} />
          ),
        )}
      </div>
    </div>
  );
}

export function TextViewer({ artifact }: TextViewerProps) {
  const {
    data: content,
    isLoading,
    error,
    refetch,
  } = useArtifactContent(artifact.id);
  const language = artifact.metadata.language ?? "plain";

  return (
    <AsyncBoundary
      className="h-full min-h-0 flex-1 overflow-auto p-4"
      label="this file"
      loading={isLoading}
      error={error}
      onRetry={() => void refetch()}
      empty={content !== undefined && content.length === 0}
      emptyIcon={FileText}
      emptyTitle="This file is empty"
      emptyDescription="There is no text content to show."
      skeleton={<TextSkeleton />}
    >
      <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
        {language}
      </div>
      <pre className="whitespace-pre-wrap break-words rounded-[var(--radius-md)] border border-border bg-surface-1 p-4 font-mono text-sm text-foreground">
        {content}
      </pre>
    </AsyncBoundary>
  );
}
