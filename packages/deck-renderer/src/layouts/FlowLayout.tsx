import type { Node as DeckNodeT } from "@deckspeed/deck-schema";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { NodeErrorBoundary } from "../nodes/NodeErrorBoundary";
import { renderNode } from "../nodes/registry";

export interface FlowLayoutProps {
  nodes: DeckNodeT[];
  byId: Map<string, DeckNodeT>;
  editable?: boolean;
  /** Required when `editable` so onNodeClick can identify the slide. */
  slideId?: string;
  selectedIds?: ReadonlySet<string>;
  onNodeClick?: (slideId: string, nodeId: string, e: MouseEvent) => void;
  /**
   * Optional slot to override the rendered content of a single node, e.g.
   * to overlay an inline-edit layer on Heading/Text in edit mode. Receives
   * `defaultContent` (the package's `renderNode` output) so wrappers can
   * fall through for node kinds they don't handle.
   *
   * Defaults to identity, preserving pure-renderer behavior.
   */
  renderNodeContent?: (
    node: DeckNodeT,
    defaultContent: ReactNode,
  ) => ReactNode;
}

export function FlowLayout({
  nodes,
  byId,
  editable,
  slideId,
  selectedIds,
  onNodeClick,
  renderNodeContent,
}: FlowLayoutProps) {
  const flowNodes = nodes.filter((n) => n.pos.mode === "flow");
  return (
    <div className="w-full h-full flex flex-col justify-center gap-6 p-12">
      {flowNodes.map((node) => {
        const isSelected = selectedIds?.has(node.id) ?? false;
        const handleClick =
          editable && onNodeClick && slideId !== undefined
            ? (e: MouseEvent) => {
                e.stopPropagation();
                onNodeClick(slideId, node.id, e);
              }
            : undefined;
        const handleKeyDown =
          editable && onNodeClick && slideId !== undefined
            ? (e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onNodeClick(slideId, node.id, e as unknown as MouseEvent);
                }
              }
            : undefined;
        const className = editable
          ? `cursor-pointer rounded ${isSelected ? "outline outline-2 outline-blue-500 outline-offset-2" : ""}`
          : "";
        const baseContent = renderNode(node, byId);
        // `renderNodeContent` may REPLACE `baseContent` entirely (the web
        // editor swaps in its own inline-edit overlay). Without an outer
        // boundary, a render error from that overlay would still bubble
        // out and unmount the slide, defeating the per-node isolation.
        const innerContent = renderNodeContent
          ? renderNodeContent(node, baseContent)
          : baseContent;
        const content = (
          <NodeErrorBoundary
            nodeId={node.id}
            nodeType={node.type}
            resetKey={node}
          >
            {innerContent}
          </NodeErrorBoundary>
        );
        if (editable) {
          return (
            // biome-ignore lint/a11y/useSemanticElements: arbitrary node contents cannot always be nested inside a <button>
            <div
              key={node.id}
              data-node-id={node.id}
              role="button"
              tabIndex={0}
              className={className}
              onClick={handleClick}
              onKeyDown={handleKeyDown}
            >
              {content}
            </div>
          );
        }
        return (
          <div key={node.id} data-node-id={node.id} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
