import type { ReactNode } from "react";
import type { Node as DeckNodeT, GroupNode as GroupNodeT } from "@deckspeed/deck-schema";
import { applyCommonStyle } from "./commonStyle";

export interface GroupNodeProps {
  node: GroupNodeT;
  byId: Map<string, DeckNodeT>;
  renderChild: (child: DeckNodeT) => ReactNode;
}

export function GroupNode({ node, byId, renderChild }: GroupNodeProps) {
  const resolved: DeckNodeT[] = [];
  for (const id of node.props.children) {
    const child = byId.get(id);
    if (child) resolved.push(child);
  }
  return (
    <div className="w-full h-full" style={applyCommonStyle(node.style)}>
      {resolved.map((child) => (
        <div key={child.id}>{renderChild(child)}</div>
      ))}
    </div>
  );
}
