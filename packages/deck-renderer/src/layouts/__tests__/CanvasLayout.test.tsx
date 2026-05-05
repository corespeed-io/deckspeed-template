import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MM_TO_PX } from "../../layout/PaperFrame";
import type { Node as DeckNodeT } from "../../schema";
import { CanvasLayout } from "../CanvasLayout";

describe("CanvasLayout", () => {
  it("positions canvas nodes absolutely in mm → px", () => {
    const nodes: DeckNodeT[] = [
      {
        id: "t1",
        type: "Text",
        pos: { mode: "canvas", unit: "mm", x: 10, y: 20, w: 50, h: 8, z: 2 },
        props: { plain: "Pos" },
      },
    ];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const { container } = render(<CanvasLayout nodes={nodes} byId={byId} />);
    const el = container.querySelector('[data-node-id="t1"]') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.left).toBe(`${10 * MM_TO_PX}px`);
    expect(el.style.top).toBe(`${20 * MM_TO_PX}px`);
    expect(el.style.width).toBe(`${50 * MM_TO_PX}px`);
    expect(el.style.height).toBe(`${8 * MM_TO_PX}px`);
    expect(el.style.zIndex).toBe("2");
  });

  // Regression: editable canvas node must NOT stopPropagation on mousedown,
  // otherwise the surrounding react-rnd wrapper never receives the event and
  // dragging silently breaks. Click (onClick) still stops propagation so
  // that selecting a node doesn't also clear selection via the background
  // handler wired in Slide.
  it("propagates mousedown so Rnd can start dragging (but stops click)", () => {
    const node: DeckNodeT = {
      id: "drag-me",
      type: "Shape",
      pos: { mode: "canvas", unit: "mm", x: 10, y: 10, w: 20, h: 20 },
      props: { kind: "rect" },
    };
    const byId = new Map([[node.id, node]]);
    const onNodeClick = vi.fn();
    const ancestorMouseDown = vi.fn();
    const ancestorClick = vi.fn();

    const { container } = render(
      // biome-ignore lint/a11y/noStaticElementInteractions: test harness probes event propagation on an ancestor wrapper, not production UI
      // biome-ignore lint/a11y/useKeyWithClickEvents: test harness probes event propagation on an ancestor wrapper, not production UI
      <div onMouseDown={ancestorMouseDown} onClick={ancestorClick}>
        <CanvasLayout
          nodes={[node]}
          byId={byId}
          editable
          slideId="showcase"
          onNodeClick={onNodeClick}
        />
      </div>,
    );
    const el = container.querySelector(
      '[data-node-id="drag-me"]',
    ) as HTMLElement;
    expect(el).not.toBeNull();

    fireEvent.mouseDown(el);
    // mousedown must bubble past the child so that Rnd (or any ancestor)
    // can handle drag-start.
    expect(ancestorMouseDown).toHaveBeenCalledTimes(1);
    // Selection still mirrored on mousedown so the node is selected before
    // dragging begins.
    expect(onNodeClick).toHaveBeenCalledTimes(1);
    // Package signature: (slideId, nodeId, event). Editor wrappers in
    // apps/web translate this into the legacy (nodeId, shiftKey) shape
    // they consume internally.
    expect(onNodeClick).toHaveBeenLastCalledWith(
      "showcase",
      "drag-me",
      expect.objectContaining({ type: "mousedown" }),
    );

    fireEvent.click(el);
    // Click still stops propagation — background-click deselection logic in
    // Slide must not fire after clicking a node.
    expect(ancestorClick).not.toHaveBeenCalled();
    expect(onNodeClick).toHaveBeenCalledTimes(2);
    expect(onNodeClick).toHaveBeenLastCalledWith(
      "showcase",
      "drag-me",
      expect.objectContaining({ type: "click" }),
    );
  });

  it("skips flow-mode nodes", () => {
    const nodes: DeckNodeT[] = [
      {
        id: "flow",
        type: "Text",
        pos: { mode: "flow" },
        props: { plain: "Should not appear" },
      },
    ];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const { container } = render(<CanvasLayout nodes={nodes} byId={byId} />);
    expect(container.querySelector('[data-node-id="flow"]')).toBeNull();
  });

  // Regression guard: PR-D re-introduces editor injection slots so apps/web
  // can wrap each canvas item with react-rnd without forking the layout.
  // Verify the slot receives the full args contract and that wrapping the
  // defaultItem still preserves data-node-id / click handlers.
  it("invokes renderCanvasItem with contract args and renders the wrapped output", () => {
    const node: DeckNodeT = {
      id: "wrap-me",
      type: "Shape",
      pos: { mode: "canvas", unit: "mm", x: 5, y: 5, w: 10, h: 10 },
      props: { kind: "rect" },
    };
    const byId = new Map([[node.id, node]]);
    const onNodeClick = vi.fn();
    const renderCanvasItem = vi.fn(({ defaultItem }) => (
      <div data-testid="rnd-wrapper">{defaultItem}</div>
    ));

    const { container, getByTestId } = render(
      <CanvasLayout
        nodes={[node]}
        byId={byId}
        editable
        slideId="s1"
        onNodeClick={onNodeClick}
        renderCanvasItem={renderCanvasItem}
      />,
    );

    // Slot was called once with the documented args, including the pre-built
    // defaultItem ReactNode. Hosts compose around this — they don't have to
    // re-build click wiring or coordinates themselves.
    expect(renderCanvasItem).toHaveBeenCalledTimes(1);
    const args = renderCanvasItem.mock.calls[0][0];
    expect(args.node).toBe(node);
    expect(args.slideId).toBe("s1");
    expect(args.editable).toBe(true);
    expect(args.selected).toBe(false);
    expect(args.defaultItem).toBeTruthy();

    // Wrapper rendered AND defaultItem still rendered inside it — proves
    // composition works (host can inject without dropping layout output).
    expect(getByTestId("rnd-wrapper")).not.toBeNull();
    const inner = container.querySelector('[data-node-id="wrap-me"]');
    expect(inner).not.toBeNull();
  });

  // renderNodeContent is the lighter slot — wrap the rendered node body
  // (e.g. overlay InlineText on Heading/Text). Verify identity-default
  // behavior (no slot = unchanged) AND that providing the slot replaces
  // the rendered content while leaving positioning intact.
  it("invokes renderNodeContent and substitutes node body while preserving positioning", () => {
    const node: DeckNodeT = {
      id: "edit-me",
      type: "Text",
      pos: { mode: "canvas", unit: "mm", x: 0, y: 0, w: 50, h: 10 },
      props: { plain: "static" },
    };
    const byId = new Map([[node.id, node]]);
    const renderNodeContent = vi.fn((_n, _defaultContent) => (
      <span data-testid="inline-edit">editing</span>
    ));

    const { container, getByTestId } = render(
      <CanvasLayout
        nodes={[node]}
        byId={byId}
        renderNodeContent={renderNodeContent}
      />,
    );

    expect(renderNodeContent).toHaveBeenCalledTimes(1);
    // Substituted content rendered.
    expect(getByTestId("inline-edit")).not.toBeNull();
    // Positioning still on the outer item — slot replaces inner body, not
    // the absolute-positioned wrapper that owns left/top/width/height.
    const positioned = container.querySelector(
      '[data-node-id="edit-me"]',
    ) as HTMLElement;
    expect(positioned).not.toBeNull();
    expect(positioned.style.left).toBe(`${0 * MM_TO_PX}px`);
    expect(positioned.style.width).toBe(`${50 * MM_TO_PX}px`);
  });
});
