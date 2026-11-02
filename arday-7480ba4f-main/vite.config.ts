import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [
      "scholplus.com",
      ".scholplus.com",
    ],
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
      "/uploads": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      devOptions: { enabled: false },
      includeAssets: [
        "favicon.ico",
        "favicon-32x32.png",
        "apple-touch-icon.png",
        "robots.txt",
        "offline.html",
      ],
      manifest: {
        name: "ScholPlus — School Management",
        short_name: "ScholPlus",
        description:
          "ScholPlus is a complete multi-tenant school management system for admissions, attendance, grades, finance, and parent communication.",
        id: "/",
        start_url: "/?source=pwa",
        scope: "/",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone", "minimal-ui", "browser"],
        orientation: "portrait",
        background_color: "#FFFFFF",
        theme_color: "#2563EB",
        lang: "en",
        dir: "ltr",
        categories: ["education", "productivity", "business"],
        prefer_related_applications: false,
        icons: [
          { src: "/icon-72x72.png", sizes: "72x72", type: "image/png", purpose: "any" },
          { src: "/icon-96x96.png", sizes: "96x96", type: "image/png", purpose: "any" },
          { src: "/icon-128x128.png", sizes: "128x128", type: "image/png", purpose: "any" },
          { src: "/icon-144x144.png", sizes: "144x144", type: "image/png", purpose: "any" },
          { src: "/icon-152x152.png", sizes: "152x152", type: "image/png", purpose: "any" },
          { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-384x384.png", sizes: "384x384", type: "image/png", purpose: "any" },
          { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
        ],
        shortcuts: [
          {
            name: "Dashboard",
            short_name: "Home",
            description: "Open your ScholPlus dashboard",
            url: "/?source=pwa_shortcut",
            icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Sign in",
            short_name: "Sign in",
            description: "Sign in to ScholPlus",
            url: "/auth?source=pwa_shortcut",
            icons: [{ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }],
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2,ttf}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/rest\//, /^\/functions\//],
        additionalManifestEntries: [{ url: "/offline.html", revision: "1" }],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
            handler: "NetworkFirst",
            options: {
              cacheName: "html-navigations",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 },
              precacheFallback: { fallbackURL: "/offline.html" },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && /\.(?:js|css)$/i.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "font",
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            method: "GET",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 5 },
              cacheableResponse: { statuses: [0, 200] },
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
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 1500,
  },
}));
