import * as pdfjsLib from "pdfjs-dist";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { artifactContentUrl } from "@/services/mediaViewerClient";
import type { ArtifactRecord } from "@/types/mediaViewer";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface PdfViewerProps {
  artifact: ArtifactRecord;
}

export function PdfViewer({ artifact }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      setError(null);
      try {
        const response = await fetch(artifactContentUrl(artifact.id));
        const buffer = await response.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) return;

        setPageCount(pdf.numPages);
        const safePage = Math.min(pageNumber, pdf.numPages);
        const page = await pdf.getPage(safePage);
        const viewport = page.getViewport({ scale: 1.25 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvas, canvasContext: context, viewport }).promise;
      } catch (renderError) {
        if (!cancelled) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Failed to render PDF",
          );
        }
      }
    }

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [artifact.id, pageNumber]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-muted/20">
      <div className="flex items-center justify-center gap-2 border-b border-border px-4 py-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber((page) => Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          Page {pageNumber} of {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={pageNumber >= pageCount}
          onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-auto p-4">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <canvas ref={canvasRef} className="shadow-sm" />
        )}
      </div>
    </div>
  );
}
