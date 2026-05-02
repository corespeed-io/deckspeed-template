import { describe, expect, it } from "vitest";
import { isSafeImageUrl } from "./safeUrl";

describe("isSafeImageUrl", () => {
  it("rejects data:image/svg+xml URLs", () => {
    expect(isSafeImageUrl("data:image/svg+xml;base64,PHN2Zy8+")).toBe(false);
  });

  it("accepts data:image/avif URLs", () => {
    expect(isSafeImageUrl("data:image/avif;base64,AAAA")).toBe(true);
  });

  it("accepts data:image/png URLs (regression)", () => {
    expect(isSafeImageUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
  });
});
