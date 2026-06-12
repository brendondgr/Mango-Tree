import { formatBytes } from "@/features/chat/utils/fileType";
import type { ArtifactRecord } from "@/types/mediaViewer";

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

interface ArtifactPropertiesPanelProps {
  artifact: ArtifactRecord;
}

export function ArtifactPropertiesPanel({ artifact }: ArtifactPropertiesPanelProps) {
  const { metadata } = artifact;

  const rows: Array<{ label: string; value: string | null | undefined }> = [
    { label: "ID", value: artifact.id },
    { label: "Filename", value: artifact.filename },
    { label: "MIME type", value: artifact.mime_type },
    { label: "Kind", value: artifact.kind },
    { label: "Size", value: formatBytes(artifact.size_bytes) },
    { label: "Created", value: formatTimestamp(artifact.created_at) },
    { label: "Source", value: artifact.source },
    { label: "Chat session", value: artifact.source_chat_session_id },
    { label: "Message", value: artifact.source_message_id },
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
    { label: "SHA-256", value: metadata.checksum_sha256 },
  ];

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-card">
      <div className="shrink-0 border-b border-border px-4 py-2">
        <h3 className="text-sm font-semibold text-foreground">Properties</h3>
      </div>
      <dl className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {rows.map(({ label, value }) => (
          <div key={label} className="space-y-1">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </dt>
            <dd className="break-all font-mono text-xs text-foreground">
              {value ?? "—"}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
