import type { Background, Node as DeckNodeT, Slide as SlideT } from "@deckspeed/deck-schema";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import {
  CanvasLayout,
  type CanvasLayoutProps,
  type RenderCanvasItemArgs,
} from "./layouts/CanvasLayout";
import { FlowLayout } from "./layouts/FlowLayout";
import { safeBackgroundImage, safeGradientCss } from "./utils/safeUrl";

export type { RenderCanvasItemArgs } from "./layouts/CanvasLayout";

function backgroundStyle(bg: Background | undefined): CSSProperties {
  // Default to a solid white "paper" when no background is specified so a
  // slide always has a visible surface (matches PowerPoint/Keynote/Figma's
  // blank-page convention). Decks can still override by setting any
  // Background variant.
  if (!bg) return { background: "white" };
  switch (bg.kind) {
    case "color":
      return { background: bg.value };
    case "gradient": {
      // Don't hand raw `bg.css` to inline style — it's a user/agent
      // string that can contain `url(...)`, `@import`, or control chars
      // that escape the declaration and load attacker resources. The
      // sanitizer returns `undefined` for anything suspect; fall back
      // to no background rather than partial/attacker-influenced CSS.
      const safe = safeGradientCss(bg.css);
      if (!safe) return {};
      return { background: safe };
    }
    case "image": {
      // Use the CSS-safe helper: rejects `javascript:` / `file:` / non-image
      // `data:` URIs, and wraps the URL in an escaped double-quoted form so
      // a crafted src cannot break out of the `url(...)` function.
      const bgImage = safeBackgroundImage(bg.src);
      if (!bgImage) return {};
      return {
        backgroundImage: bgImage,
        backgroundSize: bg.fit === "contain" ? "contain" : "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      };
    }
  }
}

export interface SlideProps {
  slide: SlideT;
  /** When provided, slide is editable; consumer must wire selection events. */
  editable?: boolean;
  /** Set of selected node IDs (consumer-managed). */
  selectedIds?: ReadonlySet<string>;
  /** Click on a node — consumer handles selection state. */
  onNodeClick?: (slideId: string, nodeId: string, e: MouseEvent) => void;
  /** Click on background — consumer handles deselection. */
  onBackgroundClick?: (e: MouseEvent) => void;
  /**
   * Wrap each canvas-positioned item. Hosts use this to re-inject editor
   * affordances (e.g. react-rnd for drag/resize, snap-to-grid) without the
   * package depending on any editor library or store. Forwarded to
   * CanvasLayout; ignored in flow-mode slides.
   */
  renderCanvasItem?: (args: RenderCanvasItemArgs) => ReactNode;
  /**
   * Wrap a node's rendered content. Hosts use this to overlay an inline-edit
   * layer (e.g. contentEditable) on Heading/Text in edit mode. Receives the
   * package's default rendered content so wrappers can fall through for node
   * kinds they don't handle. Forwarded to both layouts.
   */
  renderNodeContent?: (
    node: DeckNodeT,
    defaultContent: ReactNode,
  ) => ReactNode;
  /**
   * Absolute-positioned overlay rendered inside the slide root after the
   * layout. Hosts use this for editor chrome that lives in slide-coordinate
   * space — snap guides, marquee selection, etc. The slide root is
   * `position: relative` so overlay children using `absolute inset-0` anchor
   * correctly.
   */
  editorOverlay?: ReactNode;
  /** Pointer handlers attached to the canvas layout root. */
  canvasPointerHandlers?: CanvasLayoutProps["canvasPointerHandlers"];
  /** Overlay rendered inside the canvas layout root after canvas nodes. */
  canvasOverlay?: ReactNode;
}

export function Slide({
  slide,
  editable,
  selectedIds = new Set(),
  onNodeClick,
  onBackgroundClick,
  renderCanvasItem,
  renderNodeContent,
  editorOverlay,
  canvasPointerHandlers,
  canvasOverlay,
}: SlideProps) {
  const byId = new Map(slide.nodes.map((n) => [n.id, n]));
  // When editable AND a background-click handler is provided, the background
  // acts as a "click empty space to deselect" surface.
  const interactiveProps =
    editable && onBackgroundClick ? { onClick: onBackgroundClick } : {};
  return (
    <div
      data-slide-id={slide.id}
      className="w-full h-full relative text-3xl"
      style={backgroundStyle(slide.background)}
      {...interactiveProps}
    >
      {slide.layout.mode === "flow" ? (
        <FlowLayout
          nodes={slide.nodes}
          byId={byId}
          editable={editable}
          slideId={slide.id}
          selectedIds={selectedIds}
          onNodeClick={onNodeClick}
          renderNodeContent={renderNodeContent}
        />
      ) : (
        <CanvasLayout
          nodes={slide.nodes}
          byId={byId}
          editable={editable}
          slideId={slide.id}
          selectedIds={selectedIds}
          onNodeClick={onNodeClick}
          renderCanvasItem={renderCanvasItem}
          renderNodeContent={renderNodeContent}
          canvasPointerHandlers={canvasPointerHandlers}
          canvasOverlay={canvasOverlay}
        />
      )}
      {editorOverlay}
    </div>
  );
}
