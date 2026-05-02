import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImageNode } from "../ImageNode";

describe("ImageNode", () => {
  it("renders img with src + alt + fit", () => {
    render(
      <ImageNode
        node={{
          id: "i",
          type: "Image",
          pos: { mode: "flow" },
          props: { src: "/a.png", alt: "A", fit: "contain" },
        }}
      />,
    );
    const img = screen.getByAltText("A") as HTMLImageElement;
    expect(img.src).toContain("/a.png");
    expect(img.style.objectFit).toBe("contain");
  });
});
