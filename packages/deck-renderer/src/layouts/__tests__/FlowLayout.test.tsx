import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Node as DeckNodeT } from "../../schema";
import { FlowLayout } from "../FlowLayout";

afterEach(() => cleanup());

describe("FlowLayout", () => {
  it("renders flow nodes in order and skips canvas nodes", () => {
    const nodes: DeckNodeT[] = [
      {
        id: "h1",
        type: "Heading",
        pos: { mode: "flow" },
        props: { level: 1, text: "First" },
      },
      {
        id: "t1",
        type: "Text",
        pos: { mode: "flow" },
        props: { plain: "Second" },
      },
      {
        id: "skip",
        type: "Text",
        pos: { mode: "canvas", unit: "mm", x: 0, y: 0, w: 10, h: 10 },
        props: { plain: "Should not appear" },
      },
    ];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    render(<FlowLayout nodes={nodes} byId={byId} />);
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
    expect(screen.queryByText("Should not appear")).toBeNull();
  });

  it("isolates a renderNodeContent override that throws", () => {
    // Regression: `renderNodeContent` may REPLACE the boundary-wrapped
    // baseContent (the web editor swaps in inline-edit overlays). Without
    // an outer boundary in FlowLayout, a render error from the override
    // would unmount the whole slide. This test verifies the layout-level
    // boundary catches override failures while siblings keep rendering.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const bad: DeckNodeT = {
        id: "bad",
        type: "Heading",
        pos: { mode: "flow" },
        props: { level: 1, text: "raw" },
      };
      const sibling: DeckNodeT = {
        id: "ok",
        type: "Text",
        pos: { mode: "flow" },
        props: { plain: "still here" },
      };
      const byId = new Map([
        [bad.id, bad],
        [sibling.id, sibling],
      ]);
      const Crash = () => {
        throw new Error("override crash");
      };
      render(
        <FlowLayout
          nodes={[bad, sibling]}
          byId={byId}
          renderNodeContent={(node, defaultContent) =>
            node.id === "bad" ? <Crash /> : defaultContent
          }
        />,
      );
      expect(screen.getByRole("alert").getAttribute("data-node-id")).toBe(
        "bad",
      );
      expect(screen.getByText("still here")).toBeTruthy();
    } finally {
      errSpy.mockRestore();
    }
  });
});
