import type { ReactNode } from "react";
import type { Node as DeckNodeT } from "@deckspeed/deck-schema";
import { ChartNode } from "./ChartNode";
import { GroupNode } from "./GroupNode";
import { HeadingNode } from "./HeadingNode";
import { ImageNode } from "./ImageNode";
import { MathNode } from "./MathNode";
import { NodeErrorBoundary } from "./NodeErrorBoundary";
import { ShapeNode } from "./ShapeNode";
import { TextNode } from "./TextNode";
import { ThreeNode } from "./ThreeNode";

// §Task15 — single dispatcher that every layout and selection layer uses.
// Keeps the 8-way switch exhaustive via the `never` assignment at the end so
// future node types raise a compile error until they are wired in.
export function renderNode(
  node: DeckNodeT,
  byId: Map<string, DeckNodeT>,
): ReactNode {
  // `resetKey={node}` clears the boundary whenever Immer issues a new node
  // reference (i.e. on any deck mutation that touches this subtree), so a
  // transient render failure recovers automatically once the data changes.
  return (
    <NodeErrorBoundary
      key={node.id}
      nodeId={node.id}
      nodeType={node.type}
      resetKey={node}
    >
      {renderNodeInner(node, byId)}
    </NodeErrorBoundary>
  );
}

function renderNodeInner(
  node: DeckNodeT,
  byId: Map<string, DeckNodeT>,
): ReactNode {
  switch (node.type) {
    case "Heading":
      return <HeadingNode node={node} />;
    case "Text":
      return <TextNode node={node} />;
    case "Image":
      return <ImageNode node={node} />;
    case "Shape":
      return <ShapeNode node={node} />;
    case "Chart":
      return <ChartNode node={node} />;
    case "Math":
      return <MathNode node={node} />;
    case "Three":
      return <ThreeNode node={node} />;
    case "Group":
      return (
        <GroupNode
          node={node}
          byId={byId}
          renderChild={(child) => renderNode(child, byId)}
        />
      );
    default: {
      const _exhaustive: never = node;
      void _exhaustive;
      return null;
    }
  }
}
