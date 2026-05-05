import type { ShapeNode as ShapeNodeT } from "@deckspeed/deck-schema";
import { applyCommonStyle } from "./commonStyle";

export function ShapeNode({ node }: { node: ShapeNodeT }) {
  const { kind, fill, stroke, strokeWidth } = node.props;
  const strokeW = strokeWidth ?? 0;
  const common = {
    fill: fill ?? "transparent",
    stroke: stroke ?? "none",
    strokeWidth: strokeW,
  };
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="block w-full h-full"
      style={applyCommonStyle(node.style)}
      role="img"
      aria-label={`shape-${kind}`}
    >
      {kind === "rect" && (
        <rect
          x={strokeW / 2}
          y={strokeW / 2}
          width={100 - strokeW}
          height={100 - strokeW}
          {...common}
        />
      )}
      {kind === "ellipse" && (
        <ellipse
          cx="50"
          cy="50"
          rx={50 - strokeW / 2}
          ry={50 - strokeW / 2}
          {...common}
        />
      )}
      {kind === "line" && (
        <line
          x1="0"
          y1="50"
          x2="100"
          y2="50"
          {...common}
          stroke={stroke ?? "#000"}
          strokeWidth={strokeW || 1}
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
            y1="50"
            x2="95"
            y2="50"
            stroke={stroke ?? "#000"}
            strokeWidth={strokeW || 1}
            markerEnd={`url(#arrowhead-${node.id})`}
          />
        </g>
      )}
    </svg>
  );
}
