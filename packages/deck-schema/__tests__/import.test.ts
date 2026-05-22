import { describe, expect, it } from "vitest";
import {
  DeckMetaSchema,
  DeckSchema,
  HeadingNodeSchema,
  MathNodeSchema,
  PaperSizeSchema,
  TextNodeSchema,
} from "../src/index.js";

describe("@deckspeed/deck-schema", () => {
  it("exports DeckSchema, DeckMetaSchema, PaperSizeSchema", () => {
    expect(typeof DeckSchema).toBe("object");
    expect(typeof DeckMetaSchema).toBe("object");
    expect(typeof PaperSizeSchema).toBe("object");
  });
});

describe("autoFit field", () => {
  it("materializes default {w:true,h:true} for Heading when absent on input", () => {
    const parsed = HeadingNodeSchema.parse({
      id: "h1",
      type: "Heading",
      pos: { mode: "canvas", unit: "mm", x: 0, y: 0, w: 10, h: 10 },
      props: { text: "Hi", level: 1 },
    });
    expect(parsed.autoFit).toEqual({ w: true, h: true });
  });

  it("materializes default for Text when absent on input", () => {
    const parsed = TextNodeSchema.parse({
      id: "t1",
      type: "Text",
      pos: { mode: "canvas", unit: "mm", x: 0, y: 0, w: 10, h: 10 },
      props: { plain: "Hi" },
    });
    expect(parsed.autoFit).toEqual({ w: true, h: true });
  });

  it("preserves explicit autoFit value", () => {
    const parsed = HeadingNodeSchema.parse({
      id: "h1",
      type: "Heading",
      pos: { mode: "canvas", unit: "mm", x: 0, y: 0, w: 10, h: 10 },
      props: { text: "Hi", level: 1 },
      autoFit: { w: false, h: true },
    });
    expect(parsed.autoFit).toEqual({ w: false, h: true });
  });

  it("does not materialize Math autoFit when absent", () => {
    const parsed = MathNodeSchema.parse({
      id: "m1",
      type: "Math",
      pos: { mode: "canvas", unit: "mm", x: 0, y: 0, w: 10, h: 10 },
      props: { tex: "x", display: "block" },
    });
    expect((parsed as Record<string, unknown>).autoFit).toBeUndefined();
  });

  it("preserves explicit Math autoFit value", () => {
    const parsed = MathNodeSchema.parse({
      id: "m1",
      type: "Math",
      pos: { mode: "canvas", unit: "mm", x: 0, y: 0, w: 10, h: 10 },
      props: { tex: "x", display: "inline" },
      autoFit: { w: false, h: true },
    } as unknown);
    expect(parsed.autoFit).toEqual({ w: false, h: true });
  });

  it("rejects autoFit on block Math (only inline Math can autoFit)", () => {
    expect(() =>
      MathNodeSchema.parse({
        id: "m1",
        type: "Math",
        pos: { mode: "canvas", unit: "mm", x: 0, y: 0, w: 10, h: 10 },
        props: { tex: "x", display: "block" },
        autoFit: { w: true, h: true },
      } as unknown),
    ).toThrow(/block Math cannot carry autoFit/);
  });

  it("rejects partial autoFit input (both w and h required)", () => {
    expect(() =>
      HeadingNodeSchema.parse({
        id: "h1",
        type: "Heading",
        pos: { mode: "canvas", unit: "mm", x: 0, y: 0, w: 10, h: 10 },
        props: { text: "Hi", level: 1 },
        autoFit: { w: false }, // missing h
      }),
    ).toThrow();
  });
});
