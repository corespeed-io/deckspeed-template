import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShapeNode } from "../ShapeNode";

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
    const rect = container.querySelector("rect")!;
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
});
