import type { Node as DeckNodeT } from "@deckspeed/deck-schema";
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { MM_TO_PX } from "../layout/PaperFrame";
import { NodeErrorBoundary } from "../nodes/NodeErrorBoundary";
import { renderNode } from "../nodes/registry";

/**
 * Args passed to the `renderCanvasItem` slot. Hosts compose `defaultItem`
 * with editor wrappers (e.g. react-rnd) without forking the layout.
 */
export interface RenderCanvasItemArgs {
  node: DeckNodeT;
  slideId: string;
  editable: boolean;
  selected: boolean;
  /**
   * Pre-built positioned item: a `<div>` at (x,y,w,h) with this layout's
   * selection/click wiring and `data-node-id` already applied. Wrappers
   * that do NOT manage their own positioning should compose around it (or
   * return it as-is).
   */
  defaultItem: ReactNode;
  /**
   * Rendered node content WITHOUT positioning or selection wiring. Hosts
   * that control positioning themselves (e.g. react-rnd) should use this
   * instead of `defaultItem` to avoid double-positioning.
   */
  nodeContent: ReactNode;
}

export interface CanvasLayoutProps {
  nodes: DeckNodeT[];
  byId: Map<string, DeckNodeT>;
  /**
   * When true, canvas nodes carry click/keydown selection handlers. Drag/resize
   * and snap guides are NOT provided by this pure layout — the host injects
   * those affordances via `renderCanvasItem` (typically wrapping `defaultItem`
   * with react-rnd). Inside the package alone, "editable" only means
   * click-to-select.
   */
  editable?: boolean;
  /** Slide ID this layout is rendering. Required so onNodeClick can identify the slide. */
  slideId?: string;
  selectedIds?: ReadonlySet<string>;
  onNodeClick?: (slideId: string, nodeId: string, e: MouseEvent) => void;
  /**
   * Optional slot to wrap each canvas-positioned item. Hosts that need editor
   * affordances (drag/resize, snap-to-grid) re-inject those wrappers here
   * without the layout knowing about react-rnd or any store. Called for
   * every rendered canvas node when `slideId` is defined.
   *
   * Defaults to identity (returns `defaultItem`), preserving pure-renderer
   * behavior.
   */
  renderCanvasItem?: (args: RenderCanvasItemArgs) => ReactNode;
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

export function CanvasLayout({
  nodes,
  byId,
  editable,
  slideId,
  selectedIds,
  onNodeClick,
  renderCanvasItem,
  renderNodeContent,
}: CanvasLayoutProps) {
  return (
    <div className="w-full h-full relative">
      {nodes.map((node) => {
        if (node.pos.mode !== "canvas") return null;
        const isSelected = selectedIds?.has(node.id) ?? false;
        // Ring instead of outline — hugs the content top-left and doesn't
        // draw attention to empty space below short content in tall boxes.
        const selectedClass = isSelected
          ? "ring-2 ring-blue-500 ring-inset"
          : "";
        const handleClick =
          editable && onNodeClick && slideId !== undefined
            ? (e: MouseEvent) => {
                e.stopPropagation();
                onNodeClick(slideId, node.id, e);
              }
            : undefined;
        const handleMouseDown =
          editable && onNodeClick && slideId !== undefined
            ? (e: MouseEvent) => {
                // Mirror selection on mousedown without stopPropagation so
                // any wrapper drag library (re-injected by the web app) can
                // still receive the event and start a drag session.
                onNodeClick(slideId, node.id, e);
              }
            : undefined;
        const handleKeyDown =
          editable && onNodeClick && slideId !== undefined
            ? (e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  // Synthesize a minimal MouseEvent for type compatibility;
                  // keyboard activation never carries shift-extend semantics
                  // in this layer.
                  onNodeClick(slideId, node.id, e as unknown as MouseEvent);
                }
              }
            : undefined;

        const { x, y, w, h, z, rotate } = node.pos;
        const style: CSSProperties = {
          position: "absolute",
          left: `${x * MM_TO_PX}px`,
          top: `${y * MM_TO_PX}px`,
          width: `${w * MM_TO_PX}px`,
          height: `${h * MM_TO_PX}px`,
          zIndex: z ?? 0,
          transform: rotate ? `rotate(${rotate}deg)` : undefined,
        };

        const baseContent = renderNode(node, byId);
        // Outer boundary catches errors from `renderNodeContent` overrides
        // that would otherwise replace `baseContent` and bypass the inner
        // boundary set by `renderNode`. See FlowLayout for the same pattern.
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

        const defaultItem = handleClick ? (
          // biome-ignore lint/a11y/useSemanticElements: canvas-positioned absolute div cannot be a native button
          <div
            key={node.id}
            data-node-id={node.id}
            role="button"
            tabIndex={0}
            style={style}
            className={`cursor-pointer ${selectedClass}`}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            onMouseDown={handleMouseDown}
          >
            {content}
          </div>
        ) : (
          <div
            key={node.id}
            data-node-id={node.id}
            style={style}
            className={selectedClass}
          >
            {content}
          </div>
        );

        // Hosts can wrap the positioned item with editor affordances
        // (e.g. react-rnd for drag/resize). When no slot is supplied or
        // slideId is missing (pure-render mode), use defaultItem unchanged.
        if (renderCanvasItem && slideId !== undefined) {
          return (
            <RenderCanvasItemSlot
              key={node.id}
              args={{
                node,
                slideId,
                editable: editable ?? false,
                selected: isSelected,
                defaultItem,
                nodeContent: content,
              }}
              render={renderCanvasItem}
            />
          );
        }
        return defaultItem;
      })}
    </div>
  );
}

/**
 * Indirection so the `renderCanvasItem` slot result can carry a stable
 * React `key` without forcing the host to thread it through manually.
 */
function RenderCanvasItemSlot({
  args,
  render,
}: {
  args: RenderCanvasItemArgs;
  render: (args: RenderCanvasItemArgs) => ReactNode;
}) {
  return <>{render(args)}</>;
}
