// §C13 — MathJax must be VENDORED (not loaded from CDN). Deployed asset lives
// at /assets/vendor/mathjax/tex-svg.js; this loader uses a strict-mode safe
// singleton (persists a promise) and a DOM de-dup selector so a second mount
// under React StrictMode won't double-inject the <script>.
//
// The actual vendored files are mirrored from node_modules/mathjax/es5 into
// each app's public/assets/vendor/mathjax by scripts/copy-mathjax.mjs (at repo
// root), wired into the dev/build scripts of apps/web and templates/. For
// unit tests this loader is mocked, so the script is never fetched.

interface MathJaxAPI {
  typesetPromise: (nodes?: Element[]) => Promise<void>;
}

const VENDORED_SRC = "/assets/vendor/mathjax/tex-svg.js";
const DEDUP_ATTR = "data-mathjax-vendored";

let p: Promise<MathJaxAPI> | null = null;

export function loadMathJax(): Promise<MathJaxAPI> {
  if (p) return p;
  const pending = new Promise<MathJaxAPI>((resolve, reject) => {
    const w = window as unknown as {
      MathJax?: MathJaxAPI & Record<string, unknown>;
    };
    if (w.MathJax?.typesetPromise) return resolve(w.MathJax);

    // De-dup: if a prior instance already appended the script tag, don't
    // append another one — just wait for startup.ready.
    const existing = document.querySelector<HTMLScriptElement>(
      `script[${DEDUP_ATTR}]`,
    );

    w.MathJax = {
      ...(w.MathJax ?? {}),
      tex: { inlineMath: [["\\(", "\\)"]], displayMath: [["\\[", "\\]"]] },
      startup: {
        typeset: false,
        ready: () => {
          const mj = w.MathJax as Record<string, { defaultReady?: () => void }>;
          mj.startup.defaultReady?.();
          resolve(w.MathJax as MathJaxAPI);
        },
      },
    } as never;

    if (existing) return; // startup.ready above will fire once

    const s = document.createElement("script");
    s.src = VENDORED_SRC;
    s.async = true;
    s.setAttribute(DEDUP_ATTR, "true");
    s.onerror = () => {
      // Remove the failed script and the partial MathJax bootstrap so a retry
      // re-injects from scratch instead of finding the dedup tag and hanging.
      s.remove();
      if (!w.MathJax?.typesetPromise) {
        try {
          delete (w as { MathJax?: unknown }).MathJax;
        } catch {
          w.MathJax = undefined;
        }
      }
      reject(new Error(`MathJax vendored load failed: ${VENDORED_SRC}`));
    };
    document.head.appendChild(s);
  });
  // Don't cache rejection — clear the singleton on failure so a remount can
  // retry instead of being permanently broken after the first failed load.
  pending.catch(() => {
    if (p === pending) p = null;
  });
  p = pending;
  return p;
}
