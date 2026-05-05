import type { TextNode as TextNodeT } from "@deckspeed/deck-schema";
import type { CSSProperties } from "react";
import { useRenderMode } from "../renderMode";
import { applyCommonStyle } from "./commonStyle";

// Pure renderer: TextNode in this package is read-only, even in edit mode.
// The apps/web wrapper (B2.3) overlays an inline-edit layer on top of this
// static <p> when needed — keeping the renderer free of store coupling.
// Phase 1 ignores `lexical`; Phase 2 swaps this out for a Lexical reader
// per §C15/§C16 (blur-commit + 200KB cap serialized state).
export function TextNode({ node }: { node: TextNodeT }) {
  void useRenderMode();
  const className = "whitespace-pre-wrap leading-relaxed";
  const style = {
    textAlign: node.props.align ?? "left",
    ...applyCommonStyle(node.style),
  };
  return (
    <p className={className} style={style as CSSProperties}>
      {node.props.plain}
    </p>
  );
}
