import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageSrcProvider } from "../../context/ImageSrcContext";
import { ImageNode } from "../ImageNode";

// deck-renderer's vitest config sets `globals: false`, which disables
// @testing-library/react's auto-cleanup — without an explicit cleanup
// here, mounted DOM trees from earlier tests leak into later ones.
// Matches the pattern used in ChartNode.test.tsx, registry.test.tsx.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

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

  it("does not render an image with an empty src while async src resolves", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { container } = render(
      <ImageSrcProvider value={() => new Promise<string>(() => {})}>
        <ImageNode
          node={{
            id: "i",
            type: "Image",
            pos: { mode: "flow" },
            props: { src: "/files/content/image-1", alt: "A", fit: "contain" },
          }}
        />
      </ImageSrcProvider>,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(consoleError.mock.calls.flat().join("\n")).not.toContain(
      'An empty string ("") was passed to the src attribute',
    );
  });

  it("renders <img> after resolving to an unsafe URL (preserves broken-image UX)", () => {
    // safeImgSrc returns "" for unsafe URLs intentionally — see safeUrl.ts.
    // The browser's broken-image icon is the visible signal to the author
    // that the URL was rejected. Earlier (pre-fix) the resolver collapsed
    // the empty result to null and hid the <img> entirely, silently
    // losing that author-facing signal. The fix discriminates "pending"
    // from "resolved-with-empty-src" so the <img> tag is rendered after
    // resolution regardless of whether the src is safe.
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { container } = render(
      <ImageSrcProvider value={() => "javascript:alert(1)"}>
        <ImageNode
          node={{
            id: "i",
            type: "Image",
            pos: { mode: "flow" },
            props: { src: "x", alt: "unsafe", fit: "contain" },
          }}
        />
      </ImageSrcProvider>,
    );

    // The <img> is rendered even when safeImgSrc returns "". The exact
    // src-attribute behavior with an empty string is up to the platform
    // (React 18+ strips the attribute in JSDOM; real browsers may show
    // a broken-image icon). What matters for the contract is that the
    // <img> element is present in the DOM and not silently hidden.
    expect(container.querySelector("img")).not.toBeNull();
  });
});
