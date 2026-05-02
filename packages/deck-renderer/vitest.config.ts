/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";

// Standalone vitest config for `bun --cwd packages/deck-renderer test`.
// All tests in this package render React components (HeadingNode, TextNode,
// PaperFrame, …) and depend on `document`, `window`, `ResizeObserver`, etc.
// Without `environment: "jsdom"` the bare-Node default fails with
// `document is not defined` (codex review P2 — package vitest script
// previously inherited Node env). Vitest's built-in esbuild handles
// .tsx without the @vitejs/plugin-react dep that apps/web pulls in.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
  },
});
