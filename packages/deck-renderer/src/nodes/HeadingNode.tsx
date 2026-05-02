import type { HeadingNode as HeadingNodeT } from "@deckspeed/deck-schema";
import type { CSSProperties } from "react";
import { useRenderMode } from "../renderMode";
import { applyCommonStyle } from "./commonStyle";

const SIZE: Record<1 | 2 | 3, string> = {
  1: "text-6xl",
  2: "text-4xl",
  3: "text-2xl",
};

// Pure renderer: HeadingNode in this package is read-only, even in edit mode.
// The apps/web wrapper (B2.3) overlays an inline-edit layer on top of this
// static element when needed — keeping the renderer free of store coupling.
// `useRenderMode` is still consumed for parity with TextNode / ThreeNode and
// so future read-only optimizations (e.g. skip ARIA in thumbnail) can branch
// on mode without re-introducing the editor branch.
export function HeadingNode({ node }: { node: HeadingNodeT }) {
  const Tag = `h${node.props.level}` as "h1" | "h2" | "h3";
  void useRenderMode();
  const style = {
    textAlign: node.props.align ?? "left",
    ...applyCommonStyle(node.style),
  };
  const className = `${SIZE[node.props.level]} font-bold leading-tight`;
  return (
    <Tag className={className} style={style as CSSProperties}>
      {node.props.text}
    </Tag>
  );
}
