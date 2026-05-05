import type { Deck } from "@deckspeed/deck-schema";
import type { MouseEvent, ReactNode } from "react";
import { PaperFrame } from "./layout/PaperFrame";
import { type RenderMode, RenderModeProvider } from "./renderMode";
import { Slide, type SlideProps } from "./Slide";

// Re-export for callers that imported RenderMode from here pre-split.
export type { RenderMode };

export interface DeckRendererProps {
  deck: Deck;
  mode: RenderMode;
  /** Override which slide to render (by id). Defaults to deck.slides[0]. */
  activeSlideId?: string;
  /** Fit strategy for the paper: contain (default) or cover. */
  fillCrop?: boolean;
  /**
   * Force the slide to render as non-editable even when `mode === "edit"`.
   * Used to lock the canvas while an agent round is in flight so user edits
   * can't race agent-driven mutations.
   */
  readOnly?: boolean;
  /** Editor selection state, passed through to Slide. */
  selectedIds?: ReadonlySet<string>;
  onNodeClick?: (slideId: string, nodeId: string, e: MouseEvent) => void;
  onBackgroundClick?: (e: MouseEvent) => void;
  /** Wrap each canvas item (e.g. with DragResizeWrapper). Forwarded to Slide. */
  renderCanvasItem?: SlideProps["renderCanvasItem"];
  /** Wrap node content (e.g. with InlineText). Forwarded to Slide. */
  renderNodeContent?: SlideProps["renderNodeContent"];
  /** Editor overlay (e.g. SnapGuides). Forwarded to Slide. */
  editorOverlay?: ReactNode;
}

export function DeckRenderer({
  deck,
  mode,
  activeSlideId,
  fillCrop,
  readOnly,
  selectedIds,
  onNodeClick,
  onBackgroundClick,
  renderCanvasItem,
  renderNodeContent,
  editorOverlay,
}: DeckRendererProps) {
  const targetId = activeSlideId ?? deck.slides[0]?.id;
  const slide = targetId
    ? deck.slides.find((s) => s.id === targetId)
    : undefined;
  if (!slide) return null;
  const chromeClass = mode === "edit" ? "p-4" : "p-0";
  return (
    <RenderModeProvider value={mode}>
      <div className={`w-full h-full ${chromeClass}`}>
        <PaperFrame
          size={deck.meta.paperSize}
          orientation={deck.meta.orientation}
          fillCrop={fillCrop}
        >
          <Slide
            slide={slide}
            editable={mode === "edit" && !readOnly}
            selectedIds={selectedIds}
            onNodeClick={onNodeClick}
            onBackgroundClick={onBackgroundClick}
            renderCanvasItem={renderCanvasItem}
            renderNodeContent={renderNodeContent}
            editorOverlay={editorOverlay}
          />
        </PaperFrame>
      </div>
    </RenderModeProvider>
  );
}
