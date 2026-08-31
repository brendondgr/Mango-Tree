import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // App modules live outside the Vite root, so a test placed beside one was
    // never collected — the eight modules were structurally untestable, which
    // three separate restructures independently ran into. Their tests resolve
    // @testing-library/react and vitest through web/node_modules, so they run
    // under this config without any per-module setup.
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "../utils/apps/*/frontend/**/*.test.ts",
      "../utils/apps/*/frontend/**/*.test.tsx",
    ],
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
      // Test-only, for the same reason as the runtime aliases above: a test
      // file inside utils/apps/*/frontend cannot resolve web/node_modules by
      // walking up from its own directory.
      "@testing-library/react": path.resolve(
        __dirname,
        "./node_modules/@testing-library/react",
      ),
      vitest: path.resolve(__dirname, "./node_modules/vitest"),
    },
  },
  server: {
    host: true,
    port: 5173,
    fs: {
      // App modules live outside the Vite root, and both the dev server and
      // vitest refuse to serve a file above it without this. The aliases have
      // always pointed there; this is what lets a test file beside a module be
      // loaded as well as imported.
      allow: [path.resolve(__dirname, ".."), path.resolve(__dirname)],
    },
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
