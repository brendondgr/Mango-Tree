export type AttachmentKind = "image" | "video" | "text" | "pdf";

export interface ChatAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  previewUrl?: string;
  textContent?: string;
  language?: string;
  dataUrl?: string;
  llmNote?: string;
  error?: string;
  artifactId?: string;
}

export interface PendingAttachment {
  id: string;
  file: File;
  status: "processing" | "ready" | "error";
  attachment?: ChatAttachment;
  error?: string;
}
