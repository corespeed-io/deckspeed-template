export { DeckRenderer } from "./DeckRenderer";
export type { DeckRendererProps, RenderMode } from "./DeckRenderer";
export { Slide } from "./Slide";
export type { RenderCanvasItemArgs, SlideProps } from "./Slide";
export { MM_TO_PX, PaperFrame, usePaperScale } from "./layout/PaperFrame";
// Editor consumers (apps/web/src/deck/editor) inject inline-edit affordances
// on top of Heading/Text via Slide's `renderNodeContent` slot. They need this
// helper so the editable element's CSS matches the read-only renderer 1:1.
// Exporting it avoids duplicating the CommonStyle → CSS mapping at the call
// site and keeps the editor in sync with style-spec evolution.
export { applyCommonStyle } from "./nodes/commonStyle";
export {
  PAPER_SIZES,
  paperDimensionsMm,
} from "./layout/paperSize";
export type { Orientation, PaperSize } from "./layout/paperSize";
export { RenderModeProvider, useRenderMode } from "./renderMode";
export { ImageSrcProvider, useResolveImageSrc } from "./context/ImageSrcContext";
export type { ResolveImageSrc } from "./context/ImageSrcContext";
