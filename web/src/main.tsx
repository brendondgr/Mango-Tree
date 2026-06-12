import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { initColorPalette } from "@/app/stores/colorPaletteStore";
import { router } from "@/app/router";
import { initTheme } from "@/lib/theme";

import "@/styles/globals.css";

initTheme();
initColorPalette();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
