import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@media-viewer": path.resolve(__dirname, "../utils/apps/media_viewer/frontend"),
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "lucide-react": path.resolve(__dirname, "./node_modules/lucide-react"),
      "@tanstack/react-query": path.resolve(
        __dirname,
        "./node_modules/@tanstack/react-query",
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": {
        target: "http://localhost:9090",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
