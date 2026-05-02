import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeadingNode } from "../HeadingNode";

describe("HeadingNode", () => {
  it("renders h1 at level 1 with text", () => {
    render(
      <HeadingNode
        node={{
          id: "h",
          type: "Heading",
          pos: { mode: "flow" },
          props: { text: "Hello", level: 1 },
        }}
      />,
    );
    const h = screen.getByRole("heading", { level: 1 });
    expect(h.textContent).toBe("Hello");
  });

  it("respects align and style.color", () => {
    const { container } = render(
      <HeadingNode
        node={{
          id: "h",
          type: "Heading",
          pos: { mode: "flow" },
          style: { color: "rgb(255, 0, 0)" },
          props: { text: "X", level: 2, align: "right" },
        }}
      />,
    );
    const h = container.querySelector("h2")!;
    expect(h.style.textAlign).toBe("right");
    expect(h.style.color).toBe("rgb(255, 0, 0)");
  });
});
