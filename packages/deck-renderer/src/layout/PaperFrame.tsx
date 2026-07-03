import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  type Orientation,
  type PaperSize,
  paperDimensionsMm,
} from "./paperSize";

// Paper-precise mm→px auto-scaler.
// §C12 — editor coordinate transforms must use the same MM_TO_PX when
// converting screen-space deltas back into mm.

export const MM_TO_PX = 96 / 25.4; // CSS standard: 96 dpi, 25.4 mm/inch

// Expose the current CSS scale factor so react-rnd (DragResizeWrapper) can
// adjust mouse-to-position calculations. Without this, elements rendered
// inside a scaled PaperFrame appear at wrong positions in edit mode while
// thumbnails (which use plain CSS absolute positioning) render correctly.
const PaperScaleContext = createContext(1);
export const usePaperScale = () => useContext(PaperScaleContext);

interface Props {
  size: PaperSize;
  orientation: Orientation;
  children: ReactNode;
  /** When true, scale so the paper fills the container (may crop in one axis). */
  fillCrop?: boolean;
}

export function PaperFrame({
  size,
  orientation,
  children,
  fillCrop = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const { w: mmW, h: mmH } = paperDimensionsMm(size, orientation);
  const pxW = mmW * MM_TO_PX;
  const pxH = mmH * MM_TO_PX;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const fx = rect.width / pxW;
      const fy = rect.height / pxH;
      setScale(fillCrop ? Math.max(fx, fy) : Math.min(fx, fy));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [pxW, pxH, fillCrop]);

  // CSS `transform: scale()` doesn't shrink the layout box — the element
  // still occupies its full pre-scale dimensions. This makes flex centering
  // misalign: the paper appears offset with blank strips on one side.
  // Fix: wrap the scaled paper in a div sized to the VISUAL dimensions so
  // the flex parent centers it correctly. Scale from top-left so the wrapper
  // and paper edges align.
  const visualW = pxW * scale;
  const visualH = pxH * scale;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
    >
      <PaperScaleContext.Provider value={scale}>
        <div
          style={{
            width: `${visualW}px`,
            height: `${visualH}px`,
            flexShrink: 0,
          }}
        >
          <div
            data-paper
            style={{
              width: `${pxW}px`,
              height: `${pxH}px`,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              position: "relative",
            }}
          >
            {children}
          </div>
        </div>
      </PaperScaleContext.Provider>
    </div>
  );
}
