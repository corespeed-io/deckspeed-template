import { beforeEach, describe, expect, it, vi } from "vitest";
import { _poolSize, _resetPool, acquireSlot, MAX_CONTEXTS } from "../webglPool";

describe("webglPool (§C17)", () => {
  beforeEach(() => {
    _resetPool();
  });

  it("accepts up to MAX_CONTEXTS slots without eviction", () => {
    const evict = vi.fn();
    for (let i = 0; i < MAX_CONTEXTS; i++) acquireSlot(evict);
    expect(_poolSize()).toBe(MAX_CONTEXTS);
    expect(evict).not.toHaveBeenCalled();
  });

  it("evicts the oldest slot when capacity is exceeded", () => {
    const evicts = Array.from({ length: MAX_CONTEXTS }, () => vi.fn());
    for (const e of evicts) acquireSlot(e);
    const newEvict = vi.fn();
    acquireSlot(newEvict);
    // The first acquired slot's onEvict should fire exactly once.
    expect(evicts[0]).toHaveBeenCalledTimes(1);
    for (let i = 1; i < evicts.length; i++)
      expect(evicts[i]).not.toHaveBeenCalled();
    expect(newEvict).not.toHaveBeenCalled();
    expect(_poolSize()).toBe(MAX_CONTEXTS);
  });

  it("release removes the slot so no future eviction fires for it", () => {
    const evict = vi.fn();
    const slot = acquireSlot(evict);
    slot.release();
    expect(_poolSize()).toBe(0);
    // Fill to cap with new slots; the released slot must not be evicted.
    for (let i = 0; i < MAX_CONTEXTS; i++) acquireSlot(vi.fn());
    acquireSlot(vi.fn());
    expect(evict).not.toHaveBeenCalled();
  });
});
