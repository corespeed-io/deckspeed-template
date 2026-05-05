import type { CSSProperties } from "react";
import { MM_TO_PX } from "../layout/PaperFrame";
import type { CommonStyle } from "@deckspeed/deck-schema";
import { safeGradientCss } from "../utils/safeUrl";

// Shared CommonStyle → CSS mapper. Every node renderer spreads the result
// after its type-specific styles so CommonStyle wins ties by design.
// `rounded` is specified in mm per §C12 and converted here with MM_TO_PX.

const SHADOW_MAP: Record<NonNullable<CommonStyle["shadow"]>, string> = {
  none: "none",
  sm: "0 1px 2px rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
};

export function applyCommonStyle(style?: CommonStyle): CSSProperties {
  if (!style) return {};
  const css: CSSProperties = {};
  if (style.fontFamily) css.fontFamily = style.fontFamily;
  if (style.fontSize) css.fontSize = `${style.fontSize}px`;
  if (style.color) css.color = style.color;
  if (style.bg) {
    const safeBg = safeGradientCss(style.bg);
    if (safeBg) css.background = safeBg;
  }
  if (style.opacity !== undefined) css.opacity = style.opacity;
  if (style.rounded !== undefined)
    css.borderRadius = `${style.rounded * MM_TO_PX}px`;
  if (style.shadow) css.boxShadow = SHADOW_MAP[style.shadow];
  return css;
}
