import { createContext, useContext } from "react";

// RenderMode is threaded to leaf nodes via context so ThreeNode, ChartNode,
// and future node renderers can tree-shake live-WebGL or animations in
// read-only modes without every caller passing `mode` down.
//
// Phase 3 §C17 / §C9 — ThreeNode uses this to render a static gradient
// fallback when mode === "thumbnail" or when WebGL is unavailable
// (jsdom tests, locked-down sandbox).

export type RenderMode = "edit" | "present" | "thumbnail";

const RenderModeContext = createContext<RenderMode>("edit");

export const RenderModeProvider = RenderModeContext.Provider;

export function useRenderMode(): RenderMode {
  return useContext(RenderModeContext);
}
