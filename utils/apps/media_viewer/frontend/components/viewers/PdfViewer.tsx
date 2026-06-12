import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { pdfjsLib } from "@/lib/pdfjsSetup";
import { artifactContentUrl } from "@/services/mediaViewerClient";
import type { ArtifactRecord } from "@/types/mediaViewer";

interface PdfViewerProps {
  artifact: ArtifactRecord;
}

export function PdfViewer({ artifact }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPageNumber(1);
    setPageCount(1);
    setError(null);
  }, [artifact.id]);

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(artifactContentUrl(artifact.id));
        if (!response.ok) {
          throw new Error(`Failed to load PDF (${response.status})`);
        }

        const buffer = await response.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) return;

        const totalPages = pdf.numPages;
        setPageCount(totalPages);
        const safePage = Math.min(pageNumber, totalPages);
        const page = await pdf.getPage(safePage);
        if (cancelled) return;

        const container = containerRef.current;
        const canvas = canvasRef.current;
        if (!canvas || !container) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const containerWidth = Math.max(container.clientWidth - 32, 200);
        const containerHeight = Math.max(container.clientHeight - 32, 200);
        const scale = Math.min(
          containerWidth / baseViewport.width,
          containerHeight / baseViewport.height,
          2,
        );
        const viewport = page.getViewport({ scale });

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });
        await renderTask.promise;
      } catch (renderError) {
        if (!cancelled) {
          setError(
            renderError instanceof Error
              ? renderError.message
              : "Failed to render PDF",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    renderPage();
    return () => {
      cancelled = true;
    };
  }, [artifact.id, pageNumber]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-muted/20">
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-border px-4 py-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={pageNumber <= 1 || loading}
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
          disabled={pageNumber >= pageCount || loading}
          onClick={() => setPageNumber((page) => Math.min(pageCount, page + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={containerRef}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4"
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <canvas ref={canvasRef} className="max-h-full max-w-full shadow-sm" />
        )}
      </div>
    </div>
  );
}
