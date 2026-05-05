import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../mathjaxLoader", () => ({
  loadMathJax: vi.fn().mockResolvedValue({
    typesetPromise: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { RenderModeProvider } from "../../renderMode";
import { MathNode } from "../MathNode";

describe("MathNode", () => {
  it("writes tex into the DOM in block mode", async () => {
    const { container } = render(
      <MathNode
        node={{
          id: "m",
          type: "Math",
          pos: { mode: "flow" },
          props: { tex: "a^2+b^2", display: "block" },
        }}
      />,
    );
    await waitFor(() => {
      expect(container.textContent).toContain("\\[");
      expect(container.textContent).toContain("a^2+b^2");
    });
  });

  it("inline mode wraps with \\(...\\)", async () => {
    const { container } = render(
      <MathNode
        node={{
          id: "m",
          type: "Math",
          pos: { mode: "flow" },
          props: { tex: "x", display: "inline" },
        }}
      />,
    );
    await waitFor(() => expect(container.textContent).toContain("\\("));
  });

  it("transitions data-math-node from pending to ready after typeset", async () => {
    const { container } = render(
      <MathNode
        node={{
          id: "m",
          type: "Math",
          pos: { mode: "flow" },
          props: { tex: "a", display: "block" },
        }}
      />,
    );
    await waitFor(() => {
      const el = container.querySelector("[data-math-node]");
      expect(el?.getAttribute("data-math-node")).toBe("ready");
    });
  });

  // Math is rendered SVG (not editable text); native drag-select inside the
  // glyphs visibly shifts the formula upward while selection is active and
  // snaps back on blur. Disabling user-select kills the race.
  it("disables user-select on the wrapper", () => {
    const { container } = render(
      <MathNode
        node={{
          id: "m",
          type: "Math",
          pos: { mode: "flow" },
          props: { tex: "a", display: "block" },
        }}
      />,
    );
    const el = container.querySelector("[data-math-node]") as HTMLElement;
    expect(el.className).toContain("select-none");
  });

  // Suppresses the raw \[...\] flash users see when switching to a slide that
  // contains a math block: the wrapper renders with `visibility: hidden` until
  // MathJax has finished replacing the delimiter text with rendered SVG.
  // Default render mode (edit) only — see the present-mode test below.
  it("hides the wrapper while pending and reveals it once ready (edit mode)", async () => {
    const { container } = render(
      <MathNode
        node={{
          id: "m",
          type: "Math",
          pos: { mode: "flow" },
          props: { tex: "z^2", display: "block" },
        }}
      />,
    );
    const el = container.querySelector("[data-math-node]") as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.getAttribute("data-math-node")).toBe("pending");
    expect(el.style.visibility).toBe("hidden");
    await waitFor(() => {
      expect(el.getAttribute("data-math-node")).toBe("ready");
    });
    expect(el.style.visibility).toBe("");
  });

  // Export pipeline (`waitForMathNodes` in templates/SlideRoute.tsx) caps wait
  // at 10s and screenshots whatever is on-screen. If MathJax stays pending
  // past that timeout we want raw \[...\] in the export, not a blank box.
  it("does NOT hide while pending in present mode (export legibility)", () => {
    const { container } = render(
      <RenderModeProvider value="present">
        <MathNode
          node={{
            id: "m",
            type: "Math",
            pos: { mode: "flow" },
            props: { tex: "z^2", display: "block" },
          }}
        />
      </RenderModeProvider>,
    );
    const el = container.querySelector("[data-math-node]") as HTMLElement;
    expect(el.getAttribute("data-math-node")).toBe("pending");
    // visibility must NOT be 'hidden' in export modes — raw TeX is the
    // legibility fallback if typeset hangs past the export timeout.
    expect(el.style.visibility).toBe("");
  });

  it("does NOT hide while pending in thumbnail mode either", () => {
    const { container } = render(
      <RenderModeProvider value="thumbnail">
        <MathNode
          node={{
            id: "m",
            type: "Math",
            pos: { mode: "flow" },
            props: { tex: "z^2", display: "block" },
          }}
        />
      </RenderModeProvider>,
    );
    const el = container.querySelector("[data-math-node]") as HTMLElement;
    expect(el.style.visibility).toBe("");
  });
});
