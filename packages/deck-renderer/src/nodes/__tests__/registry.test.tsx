import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Node as DeckNodeT } from "../../schema";
import { renderNode } from "../registry";

// Vitest's `globals: false` config means @testing-library's auto-cleanup
// is not registered — without this, prior renders leak into screen.* queries.
afterEach(() => cleanup());

// Helper for tests that intentionally crash a node — silences React's
// dev-mode "uncaught error" log and the boundary's componentDidCatch log.
function withSilencedErrorLog(fn: () => void) {
  const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    fn();
  } finally {
    errSpy.mockRestore();
  }
}

function makeThrowingHeading(id: string): DeckNodeT {
  return {
    id,
    type: "Heading",
    pos: { mode: "flow" },
    props: new Proxy(
      { level: 1 },
      {
        get(target, key) {
          if (key === "text") throw new Error("simulated render-time crash");
          return (target as Record<string | symbol, unknown>)[key];
        },
        has() {
          return true;
        },
      },
    ),
  } as unknown as DeckNodeT;
}

describe("renderNode registry", () => {
  it("dispatches Heading to HeadingNode", () => {
    const n: DeckNodeT = {
      id: "h1",
      type: "Heading",
      pos: { mode: "flow" },
      props: { text: "Hi", level: 1 },
    };
    render(<>{renderNode(n, new Map([[n.id, n]]))}</>);
    expect(screen.getByRole("heading", { level: 1, name: "Hi" })).toBeTruthy();
  });

  it("dispatches Text to TextNode", () => {
    const n: DeckNodeT = {
      id: "t1",
      type: "Text",
      pos: { mode: "flow" },
      props: { plain: "hello world" },
    };
    render(<>{renderNode(n, new Map([[n.id, n]]))}</>);
    expect(screen.getByText("hello world")).toBeTruthy();
  });

  it("isolates a throwing node so siblings still render", () => {
    // Regression: Chart.js teardown on a frozen Immer array used to throw
    // an uncaught error and unmount the entire deck. Each node must now be
    // wrapped in NodeErrorBoundary so siblings keep rendering.
    withSilencedErrorLog(() => {
      const bad = makeThrowingHeading("bad");
      const sibling: DeckNodeT = {
        id: "sib",
        type: "Text",
        pos: { mode: "flow" },
        props: { plain: "i am the sibling" },
      };
      render(
        <>
          {renderNode(bad, new Map([[bad.id, bad]]))}
          {renderNode(sibling, new Map([[sibling.id, sibling]]))}
        </>,
      );
      expect(screen.getByRole("alert").getAttribute("data-node-id")).toBe(
        "bad",
      );
      expect(screen.getByText("i am the sibling")).toBeTruthy();
    });
  });

  it("isolates a throwing child INSIDE a Group, sparing siblings within it", () => {
    // Per-node boundary must wrap children rendered through Group too —
    // a chart inside a group crashing should not blank the group.
    withSilencedErrorLog(() => {
      const bad = makeThrowingHeading("bad-child");
      const goodChild: DeckNodeT = {
        id: "good-child",
        type: "Text",
        pos: { mode: "flow" },
        props: { plain: "group sibling survives" },
      };
      const group: DeckNodeT = {
        id: "g1",
        type: "Group",
        pos: { mode: "flow" },
        props: { children: [bad.id, goodChild.id] },
      };
      const byId = new Map<string, DeckNodeT>([
        [bad.id, bad],
        [goodChild.id, goodChild],
        [group.id, group],
      ]);
      render(<>{renderNode(group, byId)}</>);
      expect(
        screen.getByRole("alert").getAttribute("data-node-id"),
      ).toBe("bad-child");
      expect(screen.getByText("group sibling survives")).toBeTruthy();
    });
  });

  it("recovers automatically when the node reference changes (Immer cycle)", () => {
    // Sticky error boundaries replace "blank deck" with "permanently broken
    // node placeholder until refresh." NodeErrorBoundary is keyed by
    // resetKey={node}: every Immer commit produces a new node reference,
    // which must clear the error and re-attempt render.
    withSilencedErrorLog(() => {
      const bad = makeThrowingHeading("recoverable");
      const { rerender } = render(
        <>{renderNode(bad, new Map([[bad.id, bad]]))}</>,
      );
      // Step 1: error captured, placeholder shown.
      expect(screen.getByRole("alert").getAttribute("data-node-id")).toBe(
        "recoverable",
      );

      // Step 2: deck mutates → Immer hands the boundary a new node
      // reference for the same id. Since the new props are healthy, the
      // boundary must reset and render the node successfully.
      const healed: DeckNodeT = {
        id: "recoverable",
        type: "Heading",
        pos: { mode: "flow" },
        props: { text: "I'm fine now", level: 1 },
      };
      rerender(<>{renderNode(healed, new Map([[healed.id, healed]]))}</>);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(
        screen.getByRole("heading", { level: 1, name: "I'm fine now" }),
      ).toBeTruthy();
    });
  });

  it("recursively renders Group children through renderNode", () => {
    const child: DeckNodeT = {
      id: "t1",
      type: "Text",
      pos: { mode: "flow" },
      props: { plain: "nested" },
    };
    const group: DeckNodeT = {
      id: "g1",
      type: "Group",
      pos: { mode: "flow" },
      props: { children: ["t1"] },
    };
    const byId = new Map<string, DeckNodeT>([
      [child.id, child],
      [group.id, group],
    ]);
    render(<>{renderNode(group, byId)}</>);
    expect(screen.getByText("nested")).toBeTruthy();
  });
});
