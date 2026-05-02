import { useEffect, useRef, useState } from "react";
import type { MathNode as MathNodeT } from "@deckspeed/deck-schema";
import { applyCommonStyle } from "./commonStyle";
import { loadMathJax } from "./mathjaxLoader";

type TypesetState = "pending" | "ready" | "error";

export function MathNode({ node }: { node: MathNodeT }) {
  const ref = useRef<HTMLDivElement>(null);
  const { tex, display } = node.props;
  const wrapped = display === "block" ? `\\[${tex}\\]` : `\\(${tex}\\)`;
  const [state, setState] = useState<TypesetState>("pending");

  // Re-typeset whenever the content text changes. `wrapped` itself isn't read
  // inside the effect but gates the re-run — React renders the new `{wrapped}`
  // into the DOM, then this effect calls MathJax to transform the newly
  // written markup.
  // biome-ignore lint/correctness/useExhaustiveDependencies: wrapped gates re-typeset
  useEffect(() => {
    let cancelled = false;
    setState("pending");
    loadMathJax()
      .then((mj) => {
        if (cancelled || !ref.current) return;
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
  return (
    <div
      ref={ref}
      data-math-node={state}
      className="w-full h-full flex items-center justify-center"
      style={applyCommonStyle(node.style)}
    >
      {wrapped}
    </div>
  );
}
