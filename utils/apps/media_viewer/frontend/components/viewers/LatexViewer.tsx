import { MarkdownViewer } from "./MarkdownViewer";
import type { ArtifactRecord } from "@/types/mediaViewer";

interface LatexViewerProps {
  artifact: ArtifactRecord;
}

export function LatexViewer({ artifact }: LatexViewerProps) {
  return <MarkdownViewer artifact={artifact} />;
}
