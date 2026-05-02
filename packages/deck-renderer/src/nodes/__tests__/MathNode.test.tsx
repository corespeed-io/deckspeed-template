import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../mathjaxLoader", () => ({
  loadMathJax: vi.fn().mockResolvedValue({
    typesetPromise: vi.fn().mockResolvedValue(undefined),
  }),
}));

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
});
