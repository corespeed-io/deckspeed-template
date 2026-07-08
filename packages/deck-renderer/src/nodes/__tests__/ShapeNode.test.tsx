import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MM_TO_PX } from "../../layout/PaperFrame";
import { ShapeNode } from "../ShapeNode";

// Vitest's `globals: false` config means @testing-library's auto-cleanup
// is not registered — without this, mounted trees leak between tests and
// cross-test queries can hit stale DOM.
afterEach(() => cleanup());

function requireSvgElement<T extends SVGElement>(
  container: HTMLElement,
  selector: string,
): T {
  const element = container.querySelector<T>(selector);
  expect(element).not.toBeNull();
  if (!element) throw new Error(`Missing SVG element: ${selector}`);
  return element;
}

describe("ShapeNode", () => {
  it("renders an svg rect with fill and stroke", () => {
    const { container } = render(
      <ShapeNode
        node={{
          id: "s",
          type: "Shape",
          pos: { mode: "flow" },
          props: {
            kind: "rect",
            fill: "#fde68a",
            stroke: "#000",
            strokeWidth: 1,
          },
        }}
      />,
    );
    const rect = requireSvgElement<SVGRectElement>(container, "rect");
    expect(rect.getAttribute("fill")).toBe("#fde68a");
    expect(rect.getAttribute("stroke")).toBe("#000");
  });

  it("renders an ellipse when kind=ellipse", () => {
    const { container } = render(
      <ShapeNode
        node={{
          id: "s",
          type: "Shape",
          pos: { mode: "flow" },
          props: { kind: "ellipse" },
        }}
      />,
    );
    expect(container.querySelector("ellipse")).toBeTruthy();
  });

  it("renders canvas rounded rects with CSS border semantics", () => {
    const { container } = render(
      <ShapeNode
        node={{
          id: "s",
          type: "Shape",
          pos: {
            mode: "canvas",
            unit: "mm",
            x: 0,
            y: 0,
            w: 200,
            h: 50,
          },
          style: { rounded: 10 },
          props: {
            kind: "rect",
            fill: "#fde68a",
            stroke: "#2563eb",
            strokeWidth: 4,
          },
        }}
      />,
    );
    expect(container.querySelector("svg")).toBeNull();
    const rect = container.querySelector<HTMLElement>(
      '[data-shape-kind="rect"]',
    );
    expect(rect).not.toBeNull();
    if (!rect) throw new Error("Missing canvas rect");
    expect(rect.style.backgroundColor).toBe("rgb(253, 230, 138)");
    expect(rect.style.borderColor).toBe("rgb(37, 99, 235)");
    expect(rect.style.borderStyle).toBe("solid");
    expect(rect.style.borderWidth).toBe("4px");
    expect(rect.style.borderRadius).toBe(`${10 * MM_TO_PX}px`);
    expect(rect.style.boxSizing).toBe("border-box");
  });

  it("does not tie canvas rect border thickness to the node aspect ratio", () => {
    const { container } = render(
      <ShapeNode
        node={{
          id: "s",
          type: "Shape",
          pos: {
            mode: "canvas",
            unit: "mm",
            x: 0,
            y: 0,
            w: 200,
            h: 50,
          },
          props: {
            kind: "rect",
            fill: "#dbeafe",
            stroke: "#92400e",
            strokeWidth: 2,
          },
        }}
      />,
    );

    const rect = container.querySelector<HTMLElement>(
      '[data-shape-kind="rect"]',
    );
    expect(rect).not.toBeNull();
    if (!rect) throw new Error("Missing canvas rect");
    expect(rect.style.borderTopWidth).toBe("2px");
    expect(rect.style.borderRightWidth).toBe("2px");
    expect(rect.style.borderBottomWidth).toBe("2px");
    expect(rect.style.borderLeftWidth).toBe("2px");
  });

  it("renders canvas ellipses with CSS border semantics", () => {
    const { container } = render(
      <ShapeNode
        node={{
          id: "s",
          type: "Shape",
          pos: {
            mode: "canvas",
            unit: "mm",
            x: 0,
            y: 0,
            w: 80,
            h: 30,
          },
          props: {
            kind: "ellipse",
            stroke: "#92400e",
            strokeWidth: 4,
          },
        }}
      />,
    );

    expect(container.querySelector("svg")).toBeNull();
    const ellipse = container.querySelector<HTMLElement>(
      '[data-shape-kind="ellipse"]',
    );
    expect(ellipse).not.toBeNull();
    if (!ellipse) throw new Error("Missing canvas ellipse");
    expect(ellipse.style.borderRadius).toBe("50%");
    expect(ellipse.style.borderWidth).toBe("4px");
    expect(ellipse.style.borderStyle).toBe("solid");
  });

  it("renders line strokes as non-scaling for live resize", () => {
    const { container } = render(
      <ShapeNode
        node={{
          id: "s",
          type: "Shape",
          pos: {
            mode: "canvas",
            unit: "mm",
            x: 0,
            y: 0,
            w: 120,
            h: 10,
          },
          props: {
            kind: "line",
            stroke: "#92400e",
            strokeWidth: 3,
          },
        }}
      />,
    );

    const line = requireSvgElement<SVGLineElement>(container, "line");
    expect(line.getAttribute("vector-effect")).toBe("non-scaling-stroke");
  });

  it("does not assign canvas shape fill to the CSS background shorthand", () => {
    const { container } = render(
      <ShapeNode
        node={{
          id: "s",
          type: "Shape",
          pos: {
            mode: "canvas",
            unit: "mm",
            x: 0,
            y: 0,
            w: 50,
            h: 50,
          },
          props: {
            kind: "rect",
            fill: "url(https://example.test/fill.png)",
          },
        }}
      />,
    );
    const rect = container.querySelector<HTMLElement>(
      '[data-shape-kind="rect"]',
    );
    expect(rect).not.toBeNull();
    if (!rect) throw new Error("Missing canvas rect");
    expect(rect.style.background).toBe("");
    expect(rect.style.backgroundColor).toBe("");
  });

  it("falls back to CSS border-radius for flow-mode rect (no mm dims)", () => {
    const { container } = render(
      <ShapeNode
        node={{
          id: "s",
          type: "Shape",
          pos: { mode: "flow" },
          style: { rounded: 4 },
          props: { kind: "rect", fill: "#000" },
        }}
      />,
    );
    const rect = requireSvgElement<SVGRectElement>(container, "rect");
    expect(rect.getAttribute("rx")).toBeNull();
    expect(rect.getAttribute("ry")).toBeNull();
    const svg = requireSvgElement<SVGSVGElement>(container, "svg");
    // applyCommonStyle converts mm → px via MM_TO_PX, so non-empty string.
    expect(svg.style.borderRadius).not.toBe("");
  });
});
