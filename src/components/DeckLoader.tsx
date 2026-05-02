import { useEffect, useState } from "react";
import { DeckSchema, type Deck } from "@deckspeed/deck-schema";

export type DeckLoadState =
  | { status: "loading" }
  | { status: "ready"; deck: Deck }
  | { status: "error"; error: string };

/**
 * Fetches /deck same-origin via the Vite proxy. Returns parsed Deck or error.
 *
 * Same-origin is required because browser-rendering Puppeteer fetches the
 * template SPA from a public sandbox URL with NO user auth token. The Vite
 * dev server proxies /deck → local Deno on 127.0.0.1, which is reachable
 * inside the sandbox container.
 */
export function useDeckJson(): DeckLoadState {
  const [state, setState] = useState<DeckLoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const MAX_RETRIES = 3;
    const BASE_DELAY_MS = 1000;
    (async () => {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const res = await fetch("/deck", { credentials: "same-origin" });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} fetching /deck`);
          }
          const json = await res.json();
          const parsed = DeckSchema.safeParse(json);
          if (!parsed.success) {
            throw new Error(
              `Invalid deck schema: ${parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")}`,
            );
          }
          if (!cancelled) {
            setState({ status: "ready", deck: parsed.data });
          }
          return;
        } catch (err) {
          // Retry on transient errors (502/503 from Vite proxy while Deno
          // is still booting on cold start). Schema errors are not retried.
          if (attempt < MAX_RETRIES && !cancelled) {
            await new Promise((r) =>
              setTimeout(r, BASE_DELAY_MS * 2 ** attempt)
            );
            continue;
          }
          if (!cancelled) {
            setState({ status: "error", error: String(err) });
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
