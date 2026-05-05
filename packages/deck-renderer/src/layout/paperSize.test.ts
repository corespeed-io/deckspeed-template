import { describe, expect, it } from "vitest";
import { PAPER_SIZES, paperDimensionsMm } from "./paperSize";

describe("paperSize", () => {
  it("has all 8 sizes from spec §2", () => {
    expect(Object.keys(PAPER_SIZES).sort()).toEqual(
      [
        "A3",
        "A4",
        "A5",
        "LEGAL",
        "LETTER",
        "PRESENTATION",
        "TABLOID",
        "WIDE",
      ].sort(),
    );
  });

  it("A4 landscape is 297×210 mm", () => {
    expect(paperDimensionsMm("A4", "landscape")).toEqual({ w: 297, h: 210 });
  });

  it("A4 portrait is 210×297 mm", () => {
    expect(paperDimensionsMm("A4", "portrait")).toEqual({ w: 210, h: 297 });
  });

  it("WIDE landscape is 338.67×190.5 mm (16:9 at 13.33in)", () => {
    expect(paperDimensionsMm("WIDE", "landscape")).toEqual({
      w: 338.67,
      h: 190.5,
    });
  });
});
