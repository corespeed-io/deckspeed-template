import { useEffect, useRef, useState } from "react";
import { useParams, useSearch } from "@tanstack/react-router";
import { DeckRenderer } from "@deckspeed/deck-renderer";
import { useDeckJson } from "./DeckLoader";
import "./print.css";

interface Props {
  kind: "index" | "id";
}

export function SlideRoute({ kind }: Props) {
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false }) as {
    thumbnail?: boolean;
    lang?: string;
  };
  const deckState = useDeckJson();
  const ready = useReadinessTracking(deckState.status === "ready");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.lang = search?.lang ?? "en";
  }, [search?.lang]);

  if (deckState.status === "loading") {
    return <div data-slide-status="loading">Loading…</div>;
  }
  if (deckState.status === "error") {
    return (
      <div data-slide-status="error" data-slide-error={deckState.error}>
        Error loading deck: {deckState.error}
      </div>
    );
  }

  const deck = deckState.deck;

  // Resolve target slide.
  let slideId: string | undefined;
  if (kind === "id") {
    slideId = (params as { slideId?: string }).slideId;
  } else {
    const idxParam = (params as { index?: string }).index;
    const idx = Number.parseInt(idxParam ?? "", 10);
    if (Number.isFinite(idx) && idx >= 1 && idx <= deck.slides.length) {
      slideId = deck.slides[idx - 1]?.id;
    }
  }

  if (!slideId) {
    return <div data-slide-status="not-found">Slide not found</div>;
  }

  return (
    <div
      ref={containerRef}
      data-slide-ready={ready ? "true" : undefined}
      data-slide-id={slideId}
      className={`w-full h-screen ${
        search?.thumbnail
          ? ""
          : "flex items-center justify-center bg-gray-100 p-4"
      } print:p-0`}
    >
      <DeckRenderer
        deck={deck}
        mode={search?.thumbnail ? "thumbnail" : "present"}
        activeSlideId={slideId}
      />
    </div>
  );
}

/**
 * Per-slide readiness tracker.
 *
 * Returns `true` only after ALL of:
 *   - Deck JSON has been fetched and parsed (controlled by `enabled` flag)
 *   - All custom fonts loaded (`document.fonts.ready`)
 *   - Two animation frames have passed since enable (layout stable)
 *   - All `<img>` elements in the document are decoded
 *   - Every `[data-math-node]` has finished typesetting (state !== "pending")
 *
 * The browser-rendering screenshot waits for `[data-slide-ready]` to appear,
 * so a premature `true` produces blank/half-rendered PDFs.
 */
function useReadinessTracking(enabled: boolean): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    const { signal } = ac;
    (async () => {
      // 1. Wait for fonts.
      if (document.fonts && typeof document.fonts.ready?.then === "function") {
        await document.fonts.ready;
      }
      if (signal.aborted) return;

      // 2. Wait two animation frames so React has flushed layout/paint.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (signal.aborted) return;

      // 3. Wait for images to decode.
      const imgs = Array.from(document.querySelectorAll("img"));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? img.decode().catch(() => undefined)
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }),
        ),
      );
      if (signal.aborted) return;

      // 4. Wait for MathJax typesetting on every Math node. Each MathNode
      //    transitions data-math-node from "pending" to "ready" or "error".
      //    Without this gate, screenshots can capture raw \[...\] mid-load.
      await waitForMathNodes(signal);
      if (signal.aborted) return;

      setReady(true);
    })();
    return () => {
      // Aborts the in-flight gate so MutationObserver / setTimeout get cleaned
      // up immediately on unmount, not up to 10s later.
      ac.abort();
    };
  }, [enabled]);

  return ready;
}

const MATH_READY_TIMEOUT_MS = 10_000;

function waitForMathNodes(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();

    const allDone = () =>
      Array.from(document.querySelectorAll("[data-math-node]")).every(
        (el) => el.getAttribute("data-math-node") !== "pending",
      );

    if (allDone()) return resolve();

    const cleanup = () => {
      observer.disconnect();
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      resolve();
    };

    const observer = new MutationObserver(() => {
      if (allDone()) {
        cleanup();
        resolve();
      }
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-math-node"],
      subtree: true,
    });

    // Hard cap so a hung MathJax load (offline asset, etc.) can't block the
    // readiness signal forever — better to screenshot raw \[...\] than to hang.
    const timer = setTimeout(() => {
      cleanup();
      console.warn(
        "[SlideRoute] math typesetting did not complete within timeout",
      );
      resolve();
    }, MATH_READY_TIMEOUT_MS);

    signal.addEventListener("abort", onAbort, { once: true });
  });
}
