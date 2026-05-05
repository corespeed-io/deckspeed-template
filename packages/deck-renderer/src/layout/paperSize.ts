// Paper size table (mm). Spec §2.
//
// Landscape base (w ≥ h). Portrait is the swap.
// All ISO A-series dimensions are exact. US sizes rounded to 0.1 mm from
// inch definitions. WIDE is 13.33" × 7.5" (16:9) = 338.67 × 190.5 mm.

export const PAPER_SIZES = {
  A3: { w: 420, h: 297 },
  A4: { w: 297, h: 210 },
  A5: { w: 210, h: 148 },
  LETTER: { w: 279.4, h: 215.9 },
  LEGAL: { w: 355.6, h: 215.9 },
  TABLOID: { w: 431.8, h: 279.4 },
  PRESENTATION: { w: 254, h: 190.5 }, // 4:3 @ 10"
  WIDE: { w: 338.67, h: 190.5 }, // 16:9 @ 13.33"
} as const;

export type PaperSize = keyof typeof PAPER_SIZES;
export type Orientation = "landscape" | "portrait";

export function paperDimensionsMm(
  size: PaperSize,
  orientation: Orientation,
): { w: number; h: number } {
  const base = PAPER_SIZES[size];
  return orientation === "landscape"
    ? { w: base.w, h: base.h }
    : { w: base.h, h: base.w };
}
