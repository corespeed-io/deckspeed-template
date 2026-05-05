import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextNode } from "../TextNode";

describe("TextNode", () => {
  it("renders plain text when lexical is null", () => {
    render(
      <TextNode
        node={{
          id: "t",
          type: "Text",
          pos: { mode: "flow" },
          props: { plain: "hello world", lexical: null, align: "center" },
        }}
      />,
    );
    const p = screen.getByText("hello world");
    expect(p.style.textAlign).toBe("center");
  });
});
