import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { resolve } from "node:path";

// Sandbox-side Deno backend port. Falls back to 8001 in dev (Deno default in
// apps/sandbox/src/main.ts). The sandbox image sets DECKSPEED_SANDBOX_BACKEND_URL
// to the actual local URL when the template is launched inside a workspace.
const BACKEND_URL =
  process.env.DECKSPEED_SANDBOX_BACKEND_URL || "http://localhost:8001";

export default defineConfig({
  server: {
    hmr: false,
    allowedHosts: process.env.DECKSPEED_ALLOWED_HOSTS
      ? process.env.DECKSPEED_ALLOWED_HOSTS.split(",")
      : [],
    proxy: {
      // Same-origin proxy to local Deno backend (GET only).
      // Required because browser-rendering Puppeteer fetches the template SPA
      // from a public sandbox URL and has NO user auth token. Same-origin
      // /deck fetch through this proxy bypasses the auth boundary.
      //
      // SECURITY: only GET is proxied. The preview URL is publicly reachable
      // (Vercel deployment / Docker port mapping), so POST /deck and
      // POST /deck/apply_ops must NOT be forwarded — otherwise anyone with
      // the URL could mutate the deck without authentication.
      "/deck": {
        target: BACKEND_URL,
        changeOrigin: true,
        bypass(req) {
          if (req.method !== "GET") {
            // Return false → Vite responds 404 instead of proxying the
            // write request to the unauthenticated Deno backend.
            return false;
          }
        },
        // Retry on ECONNREFUSED — Deno may still be booting when first
        // request arrives during cold-start.
        configure: (proxy) => {
          proxy.on("error", (err) => {
            // Log but don't throw; Vite returns 502 to the client which
            // can retry.
            console.error("[/deck proxy error]", err.message);
          });
        },
      },
      // Same-origin proxy for file content (GET only).
      // Required because PDF-export Puppeteer renders the SPA from a public
      // sandbox URL and has no auth token. Same-origin /files/content fetch
      // through this proxy bypasses the auth boundary so Image nodes
      // resolve at export time.
      //
      // SECURITY: only GET is proxied. POST/PUT upload endpoints must NOT
      // be forwarded — the preview URL is publicly reachable.
      "/files/content": {
        target: BACKEND_URL,
        changeOrigin: true,
        bypass(req) {
          if (req.method !== "GET") {
            return false;
          }
        },
      },
    },
  },
  plugins: [viteReact(), tailwindcss()],
  test: {
    globals: true,
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
