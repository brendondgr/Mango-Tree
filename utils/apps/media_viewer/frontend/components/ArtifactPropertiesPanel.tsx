import { Trash2 } from "lucide-react";

import { formatBytes } from "@/features/chat/utils/fileType";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ArtifactRecord } from "@/types/mediaViewer";
import { cn } from "@/lib/utils";

import { ArtifactDeleteConfirm } from "@media-viewer/components/ArtifactDeleteConfirm";
import { useArtifactDeleteFlow } from "@media-viewer/hooks/useArtifacts";

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

interface PropertyCardProps {
  title: string;
  fields: Array<{ label: string; value: string | null | undefined }>;
  className?: string;
}

function PropertyCard({ title, fields, className }: PropertyCardProps) {
  const visibleFields = fields.filter(
    (field) => field.value != null && field.value !== "",
  );
  if (visibleFields.length === 0) return null;

  return (
    <article
      className={cn(
        "flex flex-col rounded-[var(--radius-sm)] border border-border bg-muted/20 p-3 shadow-sm",
        className,
      )}
    >
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground">
        {title}
      </h4>
      <dl className="space-y-2">
        {visibleFields.map((field) => (
          <div key={field.label} className="space-y-0.5">
            <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {field.label}
            </dt>
            <dd className="break-all font-mono text-xs text-foreground">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

interface ArtifactPropertiesPanelProps {
  artifact: ArtifactRecord;
}

export function ArtifactPropertiesPanel({ artifact }: ArtifactPropertiesPanelProps) {
  const { metadata } = artifact;
  const {
    confirmDelete,
    requestDelete,
    cancelDelete,
    handleDelete,
    isPending,
  } = useArtifactDeleteFlow(artifact.id);

  const cards: PropertyCardProps[] = [
    {
      title: "File",
      fields: [
        { label: "Filename", value: artifact.filename },
        { label: "MIME type", value: artifact.mime_type },
        { label: "Kind", value: artifact.kind },
        { label: "Size", value: formatBytes(artifact.size_bytes) },
        { label: "Created", value: formatTimestamp(artifact.created_at) },
      ],
    },
    {
      title: "Media",
      fields: [
        {
          label: "Dimensions",
          value:
            metadata.width && metadata.height
              ? `${metadata.width} × ${metadata.height}`
              : null,
        },
        {
          label: "Duration",
          value:
            metadata.duration_seconds != null
              ? `${metadata.duration_seconds.toFixed(1)}s`
              : null,
        },
        {
          label: "Pages",
          value: metadata.page_count != null ? String(metadata.page_count) : null,
        },
        { label: "Language", value: metadata.language },
      ],
    },
    {
      title: "Source",
      fields: [
        { label: "Source", value: artifact.source },
        { label: "Chat session", value: artifact.source_chat_session_id },
        { label: "Message", value: artifact.source_message_id },
      ],
    },
    {
      title: "Identity",
      fields: [
        { label: "ID", value: artifact.id },
        { label: "SHA-256", value: metadata.checksum_sha256 },
      ],
    },
  ];

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-card">
      <div className="shrink-0 border-b border-border px-4 py-2">
        <h3 className="text-sm font-semibold text-foreground">Properties</h3>
        <p className="truncate text-xs text-muted-foreground">{artifact.filename}</p>
      </div>
      <ScrollArea className="h-full min-h-0 flex-1">
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <PropertyCard key={card.title} {...card} />
          ))}
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-border px-4 py-2">
        {confirmDelete ? (
          <ArtifactDeleteConfirm
            layout="inline"
            filename={artifact.filename}
            isPending={isPending}
            onCancel={cancelDelete}
            onConfirm={handleDelete}
          />
        ) : (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={requestDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete artifact
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
