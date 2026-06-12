import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
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
      "pdfjs-dist": path.resolve(__dirname, "./node_modules/pdfjs-dist"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/v1": {
        target: "http://localhost:9090",
        changeOrigin: true,
      },
      "/tokenize": {
        target: "http://localhost:9090",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      "/v1": {
        target: "http://localhost:9090",
        changeOrigin: true,
      },
      "/tokenize": {
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
