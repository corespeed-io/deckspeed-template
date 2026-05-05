import { describe, it, expect } from "vitest";
import { DeckSchema, DeckMetaSchema, PaperSizeSchema } from "../src/index.js";

describe("@deckspeed/deck-schema", () => {
  it("exports DeckSchema, DeckMetaSchema, PaperSizeSchema", () => {
    expect(typeof DeckSchema).toBe("object");
    expect(typeof DeckMetaSchema).toBe("object");
    expect(typeof PaperSizeSchema).toBe("object");
  });
});
