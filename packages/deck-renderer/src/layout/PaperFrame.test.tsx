import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MM_TO_PX, PaperFrame } from "./PaperFrame";

class MockRO {
  cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
    MockRO.instances.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  trigger(rect: { width: number; height: number }) {
    this.cb(
      [{ contentRect: rect } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
  static instances: MockRO[] = [];
}

describe("PaperFrame", () => {
  beforeEach(() => {
    MockRO.instances = [];
    (globalThis as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      MockRO as never;
  });

  it("mm→px constant is 96/25.4", () => {
    expect(MM_TO_PX).toBeCloseTo(3.7795275591, 6);
  });

  it("renders a paper sized in mm (A4 landscape = 297×210 mm)", () => {
    const { container } = render(
      <PaperFrame size="A4" orientation="landscape">
        <div data-testid="child" />
      </PaperFrame>,
    );
    const paper = container.querySelector("[data-paper]") as HTMLElement;
    expect(paper.style.width).toBe(`${297 * MM_TO_PX}px`);
    expect(paper.style.height).toBe(`${210 * MM_TO_PX}px`);
  });

  it("applies min-fit scale to the paper after container resize", () => {
    const { container } = render(
      <PaperFrame size="A4" orientation="landscape">
        <div />
      </PaperFrame>,
    );
    const ro = MockRO.instances[0]!;
    // Container 500×300 px; paper 297×210 mm = 1122.82×794.58 px.
    act(() => {
      ro.trigger({ width: 500, height: 300 });
    });
    const paper = container.querySelector("[data-paper]") as HTMLElement;
    // min(500/1122.82, 300/794.58) ≈ min(0.445, 0.377) ≈ 0.377
    expect(paper.style.transform).toMatch(/scale\(0\.37\d+\)/);
  });
});
