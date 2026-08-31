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
  build: {
    // The build used to emit a single chunk, so any one-line change to any
    // component invalidated the whole asset for every returning visitor and
    // long-term caching bought nothing. Splitting the rarely-changing vendor
    // code out gives those bytes a stable URL across deploys.
    rollupOptions: {
      output: {
        // Matched on the resolved path, not the package name: `resolve.alias`
        // below rewrites "react" to an absolute path, so a name-keyed
        // manualChunks entry matches nothing and emits an empty chunk.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules[\\/]react(-dom)?[\\/]/.test(id)) return "react";
          if (id.includes("@tanstack")) return "tanstack";
          if (id.includes("@radix-ui")) return "radix";
          return undefined;
        },
      },
    },
    // Left at Rollup's default, but meaningful now that the build is split:
    // it warns when a chunk creeps back over budget.
    chunkSizeWarningLimit: 500,
  },
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
      "@calendar": path.resolve(__dirname, "../utils/apps/calendar/frontend"),
      "@imdbspy": path.resolve(__dirname, "../utils/apps/imdbspy/frontend"),
      "@recipes": path.resolve(__dirname, "../utils/apps/recipes/frontend"),
      "@timekeeper": path.resolve(__dirname, "../utils/apps/timekeeper/frontend"),
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
    allowedHosts: ["mango.brendondgr.com"],
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
        // Preserve the browser Host so it matches the Origin header: Django's
        // CSRF origin check rejects requests whose Origin does not match the
        // request host, and rewriting the Host (changeOrigin) would break it.
        changeOrigin: false,
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
        // Preserve the browser Host so it matches the Origin header: Django's
        // CSRF origin check rejects requests whose Origin does not match the
        // request host, and rewriting the Host (changeOrigin) would break it.
        changeOrigin: false,
      },
    },
  },
});
