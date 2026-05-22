import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ThreeNode as ThreeNodeT } from "../../schema";
import { ThreeNode } from "../ThreeNode";

describe("ThreeNode", () => {
  // Under jsdom `WebGLRenderingContext` is undefined, so per §C17 ThreeNode
  // renders the static gradient fallback instead of a live <Canvas>. Real
  // WebGL rendering is covered by Playwright/Storybook tests in Chromium.
  it("falls back to gradient when WebGL is unavailable (jsdom)", () => {
    for (const preset of ["globe", "cube-grid", "particles"] as const) {
      const node: ThreeNodeT = {
        id: `three-${preset}`,
        type: "Three",
        pos: { mode: "flow" },
        props: { preset },
      };
      const { container, unmount } = render(<ThreeNode node={node} />);
      expect(
        container.querySelector('[data-three-fallback="gradient"]'),
      ).not.toBeNull();
      unmount();
    }
  });
});
