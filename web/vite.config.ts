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
  optimizeDeps: {
    exclude: ["pdfjs-dist"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@media-viewer": path.resolve(__dirname, "../utils/apps/media_viewer/frontend"),
      "@exercise": path.resolve(__dirname, "../utils/apps/exercise/frontend"),
      "@mailbox": path.resolve(__dirname, "../utils/apps/mailbox/frontend"),
      "@projectmanager": path.resolve(
        __dirname,
        "../utils/apps/projectmanager/frontend",
      ),
      react: path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
      "lucide-react": path.resolve(__dirname, "./node_modules/lucide-react"),
      "@tanstack/react-query": path.resolve(
        __dirname,
        "./node_modules/@tanstack/react-query",
      ),
      "@tanstack/react-router": path.resolve(
        __dirname,
        "./node_modules/@tanstack/react-router",
      ),
      "pdfjs-dist": path.resolve(__dirname, "./node_modules/pdfjs-dist"),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/v1": {
        target: "http://127.0.0.1:9090",
        changeOrigin: true,
      },
      "/tokenize": {
        target: "http://127.0.0.1:9090",
        changeOrigin: true,
      },
      "/api": {
        target: "http://127.0.0.1:32553",
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      "/v1": {
        target: "http://127.0.0.1:9090",
        changeOrigin: true,
      },
      "/tokenize": {
        target: "http://127.0.0.1:9090",
        changeOrigin: true,
      },
      "/api": {
        target: "http://127.0.0.1:32553",
        changeOrigin: true,
      },
    },
  },
});
