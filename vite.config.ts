import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mcpPlugin(),
    mode === "development" && componentTagger(),
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      // The guarded wrapper in src/lib/pwa/registerServiceWorker.ts is the
      // only registrar — never let the plugin inject its own.
      injectRegister: null,
      devOptions: { enabled: false },
      // The manifest is authored by hand in public/manifest.webmanifest.
      manifest: false,
      filename: "sw.js",
      workbox: {
        // Push / notification-click handling lives in a plain script that
        // Workbox imports into the generated service worker.
        importScripts: ["/xcape-push-sw.js"],
        globPatterns: ["**/*.{js,css,html,woff2,svg,ico,png,webp}"],
        // Never precache large model binaries or generated data files.
        globIgnores: ["**/models/**", "**/sitemap.xml", "**/llms.txt"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // No cache-first navigation fallback: HTML is always network-first.
        navigateFallback: null,
        runtimeCaching: [
          {
            // App shell HTML — network first so deploys land immediately and
            // no authenticated HTML is ever served stale.
            urlPattern: ({ request, url, sameOrigin }) =>
              request.mode === "navigate" &&
              sameOrigin &&
              !url.pathname.startsWith("/~oauth") &&
              !url.pathname.startsWith("/.lovable"),
            handler: "NetworkFirst",
            options: {
              cacheName: "xcape-html",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Same-origin hashed build assets only.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith("/assets/"),
            handler: "CacheFirst",
            options: {
              cacheName: "xcape-static",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
