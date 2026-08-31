import { FileText } from "lucide-react";

import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { AsyncBoundary } from "@/components/ui/async-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import type { ArtifactRecord } from "@/types/mediaViewer";

import { useArtifactContent } from "@media-viewer/hooks/useArtifactViewer";

interface MarkdownViewerProps {
  artifact: ArtifactRecord;
}

function DocumentSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-11/12" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
}

export function MarkdownViewer({ artifact }: MarkdownViewerProps) {
  const {
    data: content,
    isLoading,
    error,
    refetch,
  } = useArtifactContent(artifact.id);

  return (
    <AsyncBoundary
      className="h-full min-h-0 flex-1 overflow-auto p-6"
      label="this document"
      loading={isLoading}
      error={error}
      onRetry={() => void refetch()}
      empty={content !== undefined && content.trim() === ""}
      emptyIcon={FileText}
      emptyTitle="This document is empty"
      emptyDescription="There is nothing to render yet."
      skeleton={<DocumentSkeleton />}
    >
      <MarkdownContent content={content ?? ""} />
    </AsyncBoundary>
  );
}
