import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Vitest's `globals: false` config means @testing-library's auto-cleanup
// is not registered — without this, mounted trees leak between tests and
// cross-test interference can mask regressions.
afterEach(() => cleanup());

// Capture live prop references (NOT stringified) so freeze-state can be
// asserted against the actual forwarded value. JSON.stringify/parse round-trip
// thaws every nested object and silently masks regressions.
type Captured = { data: unknown; options: unknown };
const captured: Record<"bar" | "line" | "pie" | "scatter", Captured | null> = {
  bar: null,
  line: null,
  pie: null,
  scatter: null,
};

vi.mock("react-chartjs-2", () => ({
  Bar: (p: { data: unknown; options: unknown }) => {
    captured.bar = { data: p.data, options: p.options };
    return <div data-testid="bar" />;
  },
  Line: (p: { data: unknown; options: unknown }) => {
    captured.line = { data: p.data, options: p.options };
    return <div data-testid="line" />;
  },
  Pie: (p: { data: unknown; options: unknown }) => {
    captured.pie = { data: p.data, options: p.options };
    return <div data-testid="pie" />;
  },
  Scatter: (p: { data: unknown; options: unknown }) => {
    captured.scatter = { data: p.data, options: p.options };
    return <div data-testid="scatter" />;
  },
}));
vi.mock("chart.js/auto", () => ({}));

import { ChartNode } from "../ChartNode";

beforeEach(() => {
  captured.bar = null;
  captured.line = null;
  captured.pie = null;
  captured.scatter = null;
});

describe("ChartNode", () => {
  it("renders a Bar for kind=bar", () => {
    const { getByTestId } = render(
      <ChartNode
        node={{
          id: "c",
          type: "Chart",
          pos: { mode: "flow" },
          props: {
            engine: "chartjs",
            kind: "bar",
            data: { labels: ["a"], datasets: [{ label: "x", data: [1] }] },
          },
        }}
      />,
    );
    expect(getByTestId("bar")).toBeTruthy();
  });

  it("forwards mutable arrays to chart.js even when source state is frozen", () => {
    // Regression: deck store is frozen by Immer (`produceWithPatches`).
    // Chart.js patches dataset.data arrays via `Object.defineProperty` and
    // later calls `delete arr.push` on teardown — this throws on a frozen
    // array. ChartNode must clone the dataset.data arrays before handoff.
    //
    // Asserts against the LIVE forwarded reference, not a JSON projection,
    // because JSON.stringify/parse thaws everything and would falsely pass.
    const frozenInner = Object.freeze([1, 2, 3]);
    const frozenDataset = Object.freeze({ label: "x", data: frozenInner });
    const frozenData = Object.freeze({
      labels: Object.freeze(["a", "b", "c"]),
      datasets: Object.freeze([frozenDataset]),
    });

    render(
      <ChartNode
        node={{
          id: "c",
          type: "Chart",
          pos: { mode: "flow" },
          props: {
            engine: "chartjs",
            kind: "bar",
            data: frozenData as never,
          },
        }}
      />,
    );

    expect(captured.bar).not.toBeNull();
    const forwardedData = captured.bar?.data as {
      labels: string[];
      datasets: Array<{ data: number[] }>;
    };
    // datasets array AND each dataset.data array must be writable, since
    // chart.js will call `Object.defineProperty(arr, "push", …)` then
    // `delete arr.push` on those arrays specifically.
    expect(Object.isFrozen(forwardedData.datasets)).toBe(false);
    expect(Object.isFrozen(forwardedData.datasets[0]?.data)).toBe(false);
    expect(Object.isExtensible(forwardedData.datasets[0]?.data)).toBe(true);
    // Original frozen tree must be untouched.
    expect(Object.isFrozen(frozenInner)).toBe(true);
    // Values preserved.
    expect(forwardedData.datasets[0]?.data).toEqual([1, 2, 3]);
  });

  it("forwards a mutable copy of frozen labels and frozen options", () => {
    // Regression: Chart.js `addIfString`/`splice` mutates `data.labels` for
    // category scales, and merges defaults into `options` (assigning
    // `plugins`/`scales`). Both throw on Immer-frozen subtrees. The thaw
    // clone must reach all three: datasets[].data, labels, and options.
    const frozenLabels = Object.freeze(["a", "b"]);
    const frozenOptions = Object.freeze({
      responsive: true,
      plugins: Object.freeze({ legend: Object.freeze({ display: false }) }),
    });
    const frozenData = Object.freeze({
      labels: frozenLabels,
      datasets: Object.freeze([
        Object.freeze({ label: "x", data: Object.freeze([1, 2]) }),
      ]),
    });

    render(
      <ChartNode
        node={{
          id: "c",
          type: "Chart",
          pos: { mode: "flow" },
          props: {
            engine: "chartjs",
            kind: "bar",
            data: frozenData as never,
            options: frozenOptions as never,
          },
        }}
      />,
    );

    expect(captured.bar).not.toBeNull();
    const fdata = captured.bar?.data as { labels: string[] };
    const fopts = captured.bar?.options as {
      plugins: { legend: { display: boolean } };
    };
    expect(Object.isFrozen(fdata.labels)).toBe(false);
    expect(Object.isExtensible(fdata.labels)).toBe(true);
    expect(Object.isFrozen(fopts)).toBe(false);
    expect(Object.isFrozen(fopts.plugins)).toBe(false);
    expect(Object.isFrozen(fopts.plugins.legend)).toBe(false);
    // Source still frozen — no mutation upstream.
    expect(Object.isFrozen(frozenLabels)).toBe(true);
    expect(Object.isFrozen(frozenOptions)).toBe(true);
  });

  it("preserves function-valued options (callbacks, plugins) without corrupting them", () => {
    // Chart.js options often carry callbacks (tooltip, ticks, point styling)
    // and plugin instances. The thaw clone must keep function references
    // intact — structuredClone would throw DataCloneError here.
    const callback = vi.fn();
    const data = { labels: ["a"], datasets: [{ label: "x", data: [1] }] };
    const options = {
      responsive: true,
      plugins: { tooltip: { callbacks: { label: callback } } },
    } as never;

    render(
      <ChartNode
        node={{
          id: "c",
          type: "Chart",
          pos: { mode: "flow" },
          props: {
            engine: "chartjs",
            kind: "line",
            data: data as never,
            options,
          },
        }}
      />,
    );

    expect(captured.line).not.toBeNull();
    const forwardedOptions = captured.line?.options as {
      plugins: { tooltip: { callbacks: { label: typeof callback } } };
    };
    // Callback identity must survive — Chart.js binds and invokes it.
    expect(forwardedOptions.plugins.tooltip.callbacks.label).toBe(callback);
    // The thawed `options` is a NEW object, but the function reference
    // inside must be the SAME identity as the original.
    expect(forwardedOptions).not.toBe(options);
  });

  it("does not violate rules-of-hooks when engine flips between renders", () => {
    // Regression: useMemo lives inside the chartjs branch. If the engine
    // were to flip on the same component instance, React would crash with
    // "Rendered more hooks than during the previous render." The fix is
    // to dispatch to a separate component, so each branch has a stable
    // hook count. This test exercises the dispatch path in both directions.
    const node = (engine: "chartjs" | "recharts") =>
      ({
        id: "c",
        type: "Chart",
        pos: { mode: "flow" },
        props: {
          engine,
          kind: "bar",
          data: { labels: ["a"], datasets: [{ label: "x", data: [1] }] },
        },
      }) as never;

    const { rerender, getByTestId, getByText, queryByTestId } = render(
      <ChartNode node={node("chartjs")} />,
    );
    expect(getByTestId("bar")).toBeTruthy();

    rerender(<ChartNode node={node("recharts")} />);
    expect(getByText(/Recharts.*Phase 2/i)).toBeTruthy();
    expect(queryByTestId("bar")).toBeNull();

    rerender(<ChartNode node={node("chartjs")} />);
    expect(getByTestId("bar")).toBeTruthy();
  });

  it("renders a placeholder for engine=recharts in Phase 1", () => {
    const { getByText } = render(
      <ChartNode
        node={{
          id: "c",
          type: "Chart",
          pos: { mode: "flow" },
          props: {
            engine: "recharts",
            kind: "bar",
            data: { labels: [], datasets: [] },
          },
        }}
      />,
    );
    expect(getByText(/Recharts.*Phase 2/i)).toBeTruthy();
  });
});
