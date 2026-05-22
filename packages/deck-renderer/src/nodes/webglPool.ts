// §C17 — WebGL context pool. Browsers cap active WebGL contexts at ~16
// (Chrome) and evict oldest without warning. When that happens, any ThreeNode
// in the cap'd slot loses its scene silently. This pool keeps an LRU of at
// most MAX_CONTEXTS slots and proactively releases the oldest Canvas when a
// new one is about to mount.
//
// Usage:
//   const slot = acquireSlot(() => releaseThisCanvas());
//   …on unmount: slot.release();

export const MAX_CONTEXTS = 8;

export interface PoolSlot {
  id: number;
  release: () => void;
}

let nextId = 0;
const live: Array<{ id: number; onEvict: () => void }> = [];

export function acquireSlot(onEvict: () => void): PoolSlot {
  while (live.length >= MAX_CONTEXTS) {
    const oldest = live.shift();
    if (!oldest) break;
    try {
      oldest.onEvict();
    } catch {
      // best-effort; eviction must never throw into the caller
    }
  }
  const id = ++nextId;
  const entry = { id, onEvict };
  live.push(entry);
  return {
    id,
    release: () => {
      const idx = live.findIndex((e) => e.id === id);
      if (idx >= 0) live.splice(idx, 1);
    },
  };
}

export function _poolSize(): number {
  return live.length;
}

export function _resetPool(): void {
  live.length = 0;
}
