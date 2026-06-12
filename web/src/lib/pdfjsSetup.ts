import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// Legacy build polyfills Map.prototype.getOrInsertComputed for browsers that lack it.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export { pdfjsLib };
