import type { AttachmentKind } from "@/features/chat/types/attachment";

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_PDF_SIZE = 10 * 1024 * 1024;
export const MAX_TEXT_CONTENT_LENGTH = 100_000;

export const TEXT_EXTENSIONS = new Set([
  ".py",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".yaml",
  ".yml",
  ".md",
  ".txt",
  ".csv",
  ".xml",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sh",
  ".bash",
  ".zsh",
  ".toml",
  ".ini",
  ".env",
  ".sql",
  ".rs",
  ".go",
  ".java",
  ".kt",
  ".rb",
  ".php",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".swift",
  ".lua",
  ".r",
  ".dockerfile",
]);

export const FILE_INPUT_ACCEPT = [
  "image/*",
  "video/*",
  "application/pdf",
  ".pdf",
  ...TEXT_EXTENSIONS,
].join(",");

const EXTENSION_LANGUAGE: Record<string, string> = {
  ".py": "python",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "jsx",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".md": "markdown",
  ".txt": "text",
  ".csv": "csv",
  ".xml": "xml",
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "scss",
  ".sh": "bash",
  ".bash": "bash",
  ".zsh": "zsh",
  ".toml": "toml",
  ".ini": "ini",
  ".sql": "sql",
  ".rs": "rust",
  ".go": "go",
  ".java": "java",
  ".kt": "kotlin",
  ".rb": "ruby",
  ".php": "php",
  ".c": "c",
  ".cpp": "cpp",
  ".h": "c",
  ".hpp": "cpp",
  ".cs": "csharp",
  ".swift": "swift",
  ".lua": "lua",
  ".r": "r",
  ".dockerfile": "dockerfile",
  ".pdf": "pdf",
};

function getExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot === -1) return "";
  return name.slice(dot).toLowerCase();
}

export function getLanguageFromFilename(name: string): string | undefined {
  const ext = getExtension(name);
  if (!ext) return undefined;
  return EXTENSION_LANGUAGE[ext];
}

export function classifyFile(file: File): AttachmentKind {
  const mime = file.type.toLowerCase();
  const ext = getExtension(file.name);

  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf" || ext === ".pdf") return "pdf";
  if (mime.startsWith("text/") || TEXT_EXTENSIONS.has(ext)) return "text";

  return "text";
}

export function validateFileSize(file: File, kind: AttachmentKind): string | null {
  if (kind === "image" && file.size > MAX_IMAGE_SIZE) {
    return `Image exceeds ${formatBytes(MAX_IMAGE_SIZE)} limit`;
  }
  if (kind === "pdf" && file.size > MAX_PDF_SIZE) {
    return `PDF exceeds ${formatBytes(MAX_PDF_SIZE)} limit`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File exceeds ${formatBytes(MAX_FILE_SIZE)} limit`;
  }
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function truncateText(text: string, maxLength = MAX_TEXT_CONTENT_LENGTH): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n\n… [truncated]`;
}
