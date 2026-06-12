import { formatBytes } from "@/features/chat/utils/fileType";
import type { ArtifactRecord } from "@/types/mediaViewer";

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function PropertyField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="break-all font-mono text-xs text-foreground">{value ?? "—"}</dd>
    </div>
  );
}

interface ArtifactPropertiesPanelProps {
  artifact: ArtifactRecord;
}

export function ArtifactPropertiesPanel({ artifact }: ArtifactPropertiesPanelProps) {
  const { metadata } = artifact;

  const fileRows: Array<{ label: string; value: string | null | undefined }> = [
    { label: "Filename", value: artifact.filename },
    { label: "MIME type", value: artifact.mime_type },
    { label: "Kind", value: artifact.kind },
    { label: "Size", value: formatBytes(artifact.size_bytes) },
    { label: "Created", value: formatTimestamp(artifact.created_at) },
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

  const sourceRows: Array<{ label: string; value: string | null | undefined }> = [
    { label: "ID", value: artifact.id },
    { label: "Source", value: artifact.source },
    { label: "Chat session", value: artifact.source_chat_session_id },
    { label: "Message", value: artifact.source_message_id },
  ];

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-card">
      <div className="shrink-0 border-b border-border px-4 py-2">
        <h3 className="text-sm font-semibold text-foreground">Properties</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-6 md:grid-cols-2">
          <section aria-label="File details">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground">
              File
            </h4>
            <dl className="space-y-3 text-sm">
              {fileRows.map((row) => (
                <PropertyField key={row.label} {...row} />
              ))}
            </dl>
          </section>
          <section aria-label="Source details">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-foreground">
              Source
            </h4>
            <dl className="space-y-3 text-sm">
              {sourceRows.map((row) => (
                <PropertyField key={row.label} {...row} />
              ))}
            </dl>
          </section>
        </div>
      </div>
    </aside>
  );
}
