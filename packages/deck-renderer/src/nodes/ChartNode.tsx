import "chart.js/auto";
import { useMemo } from "react";
import { Bar, Line, Pie, Scatter } from "react-chartjs-2";
import type { ChartNode as ChartNodeT } from "@deckspeed/deck-schema";
import { applyCommonStyle } from "./commonStyle";

// Chart.js mutates BOTH the `data` object (patches `push`/`pop`/etc on
// `dataset.data` arrays via `Object.defineProperty`, then `delete`s those
// patches on teardown) AND the `options` object (assigns `plugins`, `scales`,
// merges defaults). It also calls `addIfString`/`splice` on `data.labels`
// for category scales, and the decimation plugin uses
// `Object.defineProperty(dataset, 'data', ...)`. Every one of those throws
// on an Immer-frozen subtree.
//
// `structuredClone` would corrupt function values (callbacks like
// `tooltip.callbacks.label`, `pointBackgroundColor: ctx => ...`, plugin
// instances). Use a function-preserving recursive thaw: clone plain objects
// and arrays into fresh, mutable copies; pass functions, class instances,
// and primitives through by reference.
function thawClone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => thawClone(v)) as unknown as T;
  }
  if (value instanceof Date) {
    return new Date(value.getTime()) as unknown as T;
  }
  // Preserve class instances (e.g. plugin objects) by reference. Only thaw
  // plain object literals, which is what frozen Immer state produces.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = thawClone(v);
  }
  return out as T;
}

export function ChartNode({ node }: { node: ChartNodeT }) {
  // Engine dispatch lives at the outer component so each branch's hook
  // count is stable. If we called hooks AFTER an early `return` for
  // recharts, flipping `engine` between renders would change the hook
  // count on the same component instance and crash with React's
  // "Rendered more hooks than during the previous render."
  if (node.props.engine === "recharts") {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm text-amber-700 bg-amber-50 rounded">
        Recharts renderer pending — Phase 2
      </div>
    );
  }
  return <ChartJsNode node={node} />;
}

function ChartJsNode({ node }: { node: ChartNodeT }) {
  // Cast is safe: chart.js accepts a superset of our validated shape.
  const isArea = node.props.kind === "area";
  // Memo the thawed data/options on the original (Immer-stable) ref so the
  // O(n) deep clone only runs when those subtrees actually change. The
  // editor re-renders ChartNode for selection/hover/parent layout updates
  // even when chart props are unchanged — without memo, large datasets
  // pay the clone cost on every keystroke.
  const dataIn = node.props.data as {
    labels?: string[];
    datasets?: Array<Record<string, unknown> & { data?: unknown[] }>;
    [key: string]: unknown;
  };
  const rawData = useMemo(() => thawClone(dataIn), [dataIn]);
  const data = useMemo(
    () =>
      (isArea && rawData?.datasets
        ? {
            ...rawData,
            datasets: rawData.datasets.map((ds) => ({ ...ds, fill: true })),
          }
        : rawData) as never,
    [isArea, rawData],
  );
  const optionsIn = node.props.options;
  const options = useMemo(
    () =>
      (thawClone(optionsIn) as never) ??
      ({
        responsive: true,
        maintainAspectRatio: false,
      } as never),
    [optionsIn],
  );
  const Component =
    node.props.kind === "line" || isArea
      ? Line
      : node.props.kind === "pie"
        ? Pie
        : node.props.kind === "scatter"
          ? Scatter
          : /* bar */ Bar;
  return (
    <div className="w-full h-full" style={applyCommonStyle(node.style)}>
      <Component data={data} options={options} />
    </div>
  );
}
