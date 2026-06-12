import * as pdfjsLib from "pdfjs-dist";

import type { ChatAttachment } from "@/features/chat/types/attachment";
import {
  classifyFile,
  getLanguageFromFilename,
  truncateText,
  validateFileSize,
} from "@/features/chat/utils/fileType";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function extractVideoPosterFrame(
  file: File,
): Promise<{ previewUrl: string; dataUrl?: string }> {
  const previewUrl = URL.createObjectURL(file);

  try {
    const dataUrl = await new Promise<string | undefined>((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.src = previewUrl;

      const cleanup = () => {
        video.removeAttribute("src");
        video.load();
      };

      video.onloadeddata = () => {
        video.currentTime = Math.min(1, video.duration / 2 || 0);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          if (!ctx || canvas.width === 0 || canvas.height === 0) {
            cleanup();
            resolve(undefined);
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const url = canvas.toDataURL("image/jpeg", 0.85);
          cleanup();
          resolve(url);
        } catch {
          cleanup();
          resolve(undefined);
        }
      };

      video.onerror = () => {
        cleanup();
        resolve(undefined);
      };
    });

    return { previewUrl, dataUrl };
  } catch {
    return { previewUrl };
  }
}

async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    if (pageText) {
      pages.push(pageText);
    }
  }

  const text = pages.join("\n\n").trim();
  if (!text) {
    throw new Error("No extractable text found (scanned PDFs are not supported)");
  }

  return truncateText(text);
}

export async function processAttachment(file: File): Promise<ChatAttachment> {
  const kind = classifyFile(file);
  const sizeError = validateFileSize(file, kind);
  if (sizeError) {
    throw new Error(sizeError);
  }

  const base: ChatAttachment = {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    kind,
    language: getLanguageFromFilename(file.name),
  };

  switch (kind) {
    case "image": {
      const dataUrl = await readFileAsDataUrl(file);
      return {
        ...base,
        previewUrl: dataUrl,
        dataUrl,
      };
    }
    case "video": {
      const { previewUrl, dataUrl } = await extractVideoPosterFrame(file);
      return {
        ...base,
        previewUrl,
        dataUrl,
        llmNote: dataUrl
          ? undefined
          : `[Attached video: ${file.name} — preview only; model cannot receive raw video]`,
      };
    }
    case "pdf": {
      const textContent = await extractPdfText(file);
      return {
        ...base,
        language: "pdf",
        textContent,
      };
    }
    case "text": {
      const raw = await file.text();
      return {
        ...base,
        textContent: truncateText(raw),
      };
    }
    default:
      throw new Error(`Unsupported file type: ${file.name}`);
  }
}

export function revokeAttachmentUrls(attachment: ChatAttachment): void {
  if (attachment.previewUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
}
