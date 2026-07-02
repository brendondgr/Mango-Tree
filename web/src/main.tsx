import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { useAuthStore } from "@/app/stores/authStore";
import { initColorPalette } from "@/app/stores/colorPaletteStore";
import { router } from "@/app/router";
import { installApiInterceptor, setUnauthorizedHandler } from "@/lib/http";
import { initTheme } from "@/lib/theme";

import "@/styles/globals.css";

initTheme();
initColorPalette();

// Wire session-cookie auth into every /api request, and let a rejected session
// flip the auth store so the route guard re-gates to /login.
installApiInterceptor();
setUnauthorizedHandler(() => useAuthStore.getState().markUnauthenticated());

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
