/**
 * pdf.js, loaded on demand.
 *
 * The library is ~459 kB minified. A static import put it in the entry chunk
 * for every visitor, when it is needed only by the artifact viewer and by
 * attaching a PDF to a chat message. The worker itself was always a separate
 * asset; this moves the main library out too.
 */

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let modulePromise: Promise<PdfjsModule> | null = null;

export function loadPdfjs(): Promise<PdfjsModule> {
  if (!modulePromise) {
    modulePromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjsLib) => {
      // The legacy build polyfills Map.prototype.getOrInsertComputed for
      // browsers that lack it.
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return pdfjsLib;
    });
  }
  return modulePromise;
}
