import type { ShapeNode as ShapeNodeT } from "@deckspeed/deck-schema";
import type { CSSProperties } from "react";
import { MM_TO_PX } from "../layout/PaperFrame";
import { applyCommonStyle } from "./commonStyle";

export function ShapeNode({ node }: { node: ShapeNodeT }) {
  const { kind, fill, stroke, strokeWidth } = node.props;
  const strokeW = strokeWidth ?? 0;
  const common = {
    fill: fill ?? "transparent",
    stroke: stroke ?? "none",
    strokeWidth: strokeW,
  };

  // Canvas shapes use the same logical px coordinate space as CanvasLayout's
  // absolute box. That makes strokeWidth behave like CSS border-width: changing
  // the box's width/height does not stretch one side of the border more than
  // another. Flow-mode shapes have no explicit dimensions, so they keep the
  // normalized 100x100 fallback.
  const box =
    node.pos.mode === "canvas"
      ? { w: node.pos.w * MM_TO_PX, h: node.pos.h * MM_TO_PX }
      : { w: 100, h: 100 };
  const halfStroke = strokeW / 2;
  const innerW = Math.max(0, box.w - strokeW);
  const innerH = Math.max(0, box.h - strokeW);
  const centerX = box.w / 2;
  const centerY = box.h / 2;
  const roundedMm = node.style?.rounded ?? 0;
  const svgStyle: CSSProperties = { ...applyCommonStyle(node.style) };

  if (node.pos.mode === "canvas" && (kind === "rect" || kind === "ellipse")) {
    const shapeStyle: CSSProperties = {
      ...svgStyle,
      boxSizing: "border-box",
    };
    if (fill !== undefined) {
      delete shapeStyle.background;
      shapeStyle.backgroundColor = fill;
    } else if (
      shapeStyle.background === undefined &&
      shapeStyle.backgroundColor === undefined
    ) {
      shapeStyle.backgroundColor = "transparent";
    }
    if (stroke && stroke !== "none" && strokeW > 0) {
      shapeStyle.borderColor = stroke;
      shapeStyle.borderStyle = "solid";
      shapeStyle.borderWidth = `${strokeW}px`;
    } else {
      shapeStyle.borderStyle = "none";
      shapeStyle.borderWidth = "0px";
    }
    if (kind === "ellipse") {
      shapeStyle.borderRadius = "50%";
    } else if (roundedMm > 0) {
      shapeStyle.borderRadius = `${roundedMm * MM_TO_PX}px`;
    }

    return (
      <div
        className="block w-full h-full"
        data-shape-kind={kind}
        style={shapeStyle}
        role="img"
        aria-label={`shape-${kind}`}
      />
    );
  }

  // SVG fallback covers flow-mode closed shapes plus canvas line/arrow shapes.
  // Canvas rect/ellipse return above as CSS boxes so their borders stay
  // uniform during live react-rnd resizing.
  return (
    <svg
      viewBox={`0 0 ${box.w} ${box.h}`}
      preserveAspectRatio="none"
      className="block w-full h-full"
      style={svgStyle}
      role="img"
      aria-label={`shape-${kind}`}
    >
      {kind === "rect" && (
        <rect
          x={halfStroke}
          y={halfStroke}
          width={innerW}
          height={innerH}
          {...common}
        />
      )}
      {kind === "ellipse" && (
        <ellipse
          cx={centerX}
          cy={centerY}
          rx={innerW / 2}
          ry={innerH / 2}
          {...common}
        />
      )}
      {kind === "line" && (
        <line
          x1="0"
          y1={centerY}
          x2={box.w}
          y2={centerY}
          {...common}
          stroke={stroke ?? "#000"}
          strokeWidth={strokeW || 1}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {kind === "arrow" && (
        <g>
          <defs>
            <marker
              id={`arrowhead-${node.id}`}
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill={stroke ?? "#000"} />
            </marker>
          </defs>
          <line
            x1="0"
            y1={centerY}
            x2={Math.max(0, box.w - 5)}
            y2={centerY}
            stroke={stroke ?? "#000"}
            strokeWidth={strokeW || 1}
            vectorEffect="non-scaling-stroke"
            markerEnd={`url(#arrowhead-${node.id})`}
          />
        </g>
      )}
    </svg>
  );
}
