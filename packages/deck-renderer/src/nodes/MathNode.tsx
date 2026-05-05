import type { MathNode as MathNodeT } from "@deckspeed/deck-schema";
import { useEffect, useRef, useState } from "react";
import { useRenderMode } from "../renderMode";
import { applyCommonStyle } from "./commonStyle";
import { loadMathJax } from "./mathjaxLoader";

type TypesetState = "pending" | "ready" | "error";

export function MathNode({ node }: { node: MathNodeT }) {
  const ref = useRef<HTMLDivElement>(null);
  const { tex, display } = node.props;
  const wrapped = display === "block" ? `\\[${tex}\\]` : `\\(${tex}\\)`;
  const [state, setState] = useState<TypesetState>("pending");
  const mode = useRenderMode();

  // Re-typeset whenever the content text changes. React first renders the
  // new `{wrapped}` into the DOM; this effect then calls MathJax to transform
  // the newly written markup. `wrapped` is captured into `intendedContent` so
  // we can both (a) re-trigger the effect when it changes (deps array) and
  // (b) verify mid-async that ref.current still holds the same source — if a
  // later prop change races ahead before the load promise resolves, the
  // captured value won't match and we skip a stale typeset (cheaper defense
  // than relying on `cancelled` alone, since `cancelled` is set in cleanup
  // but a leftover microtask can still slip through on some browsers).
  useEffect(() => {
    let cancelled = false;
    const intendedContent = wrapped;
    setState("pending");
    loadMathJax()
      .then((mj) => {
        if (cancelled || !ref.current) return;
        if (ref.current.textContent !== intendedContent) return;
        return mj
          .typesetPromise([ref.current])
          .then(() => {
            if (!cancelled) setState("ready");
          })
          .catch((err) => {
            console.error("[MathNode] typeset failed:", err);
            if (!cancelled) setState("error");
          });
      })
      .catch((err) => {
        // Surface vendored asset load failure (e.g. /assets/vendor/mathjax/tex-svg.js
        // 404) instead of silently rendering raw \[...\] delimiters forever.
        console.error("[MathNode] MathJax load failed:", err);
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [wrapped]);

  // `data-math-node` lets a slide-level readiness tracker (see
  // templates/src/components/SlideRoute.tsx) wait for typesetting to finish or
  // fail before signalling the slide is screenshot-ready. Without this, the
  // export pipeline can capture raw \[...\] mid-load.
  //
  // While `state === "pending"`, hide the wrapper with `visibility: hidden`
  // (preserves layout, suppresses the raw `\[...\]` flash before MathJax
  // replaces it). `display: none` would shrink the box and skew flex/centering
  // measurements; `visibility` keeps the bounding box intact for selection.
  //
  // BUT only hide in edit mode. In present/thumbnail mode the export pipeline
  // (`waitForMathNodes` in SlideRoute.tsx) caps wait time at 10s and then
  // screenshots whatever is on screen. Hiding pending math there means a
  // hung/slow MathJax load yields a blank rectangle in the exported PNG/PDF;
  // showing the raw `\[...\]` source is a strictly better fallback (the
  // viewer can at least read the formula). In edit mode FOUC dominates UX,
  // so hide; in export mode legibility-on-failure dominates, so don't.
  //
  // `user-select: none` — math is rendered SVG (PowerPoint/Google-Slides
  // semantics: a discrete object, not text). Letting the browser drag-select
  // glyphs inside the SVG paints a `::selection` highlight that visibly
  // shifts the formula upward while the selection is active and snaps it
  // back on blur (verified empirically — `mjx-container` sub-elements report
  // non-zero selection rects). Disabling user-select kills that race.
  return (
    <div
      ref={ref}
      data-math-node={state}
      className="w-full h-full flex items-center justify-center select-none"
      style={{
        ...applyCommonStyle(node.style),
        visibility:
          state === "pending" && mode === "edit" ? "hidden" : undefined,
      }}
    >
      {wrapped}
    </div>
  );
}
