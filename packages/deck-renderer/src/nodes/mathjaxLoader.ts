// §C13 — MathJax must be VENDORED (not loaded from CDN). Deployed asset lives
// at /assets/vendor/mathjax/tex-svg.js; this loader uses a strict-mode safe
// singleton (persists a promise) and a DOM de-dup selector so a second mount
// under React StrictMode won't double-inject the <script>.
//
// The actual vendored files are mirrored from node_modules/mathjax (v4 ships
// the bundle at the package root; v3's es5/ subdir is gone) into each app's
// public/assets/vendor/mathjax by scripts/copy-mathjax.mjs (at repo root),
// wired into the dev/build scripts of apps/web and templates/. Fonts are
// copied separately from @mathjax/mathjax-newcm-font into
// public/assets/vendor/mathjax/fonts/mathjax-newcm-font/, and this loader
// pins MathJax's loader.paths.fonts to that subdir so the default jsdelivr
// CDN URL is never used. For unit tests this loader is mocked, so the
// script is never fetched.

interface MathJaxAPI {
  typesetPromise: (nodes?: Element[]) => Promise<void>;
}

const VENDORED_SRC = "/assets/vendor/mathjax/tex-svg.js";
const VENDORED_FONTS = "/assets/vendor/mathjax/fonts";
const DEDUP_ATTR = "data-mathjax-vendored";

// MathJax v4's `tex-svg.js` eagerly bundles ui/menu and six a11y modules
// (explorer / explorerHelp / speech / braille / enrichment / complexity),
// all defaulting to ON. With defaults, focusing a typeset container draws
// a circular "info" badge above the formula and the SpeechMenu/Explorer
// repaints sub-trees with a lavender highlight that visibly shifts the SVG.
//
// Two-layer config gotcha (verified empirically against the vendored bundle):
//   1. Top-level `enableX: false` sets `document.options.enableX`, which the
//      bundle reads at the use site (e.g. `this.options.enableExplorer &&
//      this.menu.checkComponent("a11y/explorer")`).
//   2. BUT MathJax startup ALSO instantiates the menu class to read its own
//      settings and then OVERWRITES `document.options.enableEnrichment /
//      enableSpeech / enableBraille / enableComplexity / enableExplorer`
//      from `menu.settings.{enrich,speech,braille,collapsible,explorer}`.
//      Source line: `C.enableSpeech = s.speech && i;` where
//      `s = this.menu.settings, C = this.options`.
//   So setting top-level `enableSpeech: false` alone is silently clobbered
//   when the menu's default `settings.speech = true` ships unchanged. Both
//   layers must be paired.
//
// Path note: this object is assigned as `MathJax.options`, so the menu
// settings live at `MathJax.options.menuOptions.settings.X`. That nesting is
// INTENTIONAL — the runtime read site is `this.options.MenuClass(this,
// this.options.menuOptions)`, and an A/B Playwright probe confirmed:
//   - `MathJax.options.menuOptions.settings` ← suppresses (this code)
//   - `MathJax.menuOptions` (top-level, per some MathJax docs)  ← IGNORED
// Don't move `menuOptions` to a top-level sibling of `options`; it'll silently
// re-enable the menu/explorer.
//
// The two halves of this object MUST stay in sync. Each top-level
// `enableX: false` has a corresponding `menuOptions.settings.x: false`
// counterpart. Editing only one will silently re-enable the feature.
const MATHJAX_A11Y_DISABLED = {
  enableMenu: false,
  enableExplorer: false,
  enableExplorerHelp: false,
  enableSpeech: false,
  enableBraille: false,
  enableEnrichment: false,
  enableComplexity: false,
  enableAssistiveMml: false,
  // Nested under options — see "Path note" above for why top-level is wrong.
  menuOptions: {
    settings: {
      speech: false,
      braille: false,
      enrich: false,
      collapsible: false,
      assistiveMml: false,
      inTabOrder: false,
      help: false,
    },
  },
} as const;

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
      loader: {
        paths: { fonts: VENDORED_FONTS },
        // §C13: missing assets MUST throw, not console.log. The v4 default
        // is `console.log`, which silently masks vendoring gaps and lets a
        // CDN-fallback URL escape detection.
        failed: (err: { message?: string; package?: string }) => {
          const msg = `MathJax loader failed: ${err.package ?? "?"}: ${err.message ?? "unknown"}`;
          console.error("[MathJax]", msg);
          throw new Error(msg);
        },
      },
      tex: { inlineMath: [["\\(", "\\)"]], displayMath: [["\\[", "\\]"]] },
      // Both `enable*` flags AND `menuOptions.settings` must be on the same
      // object — see `MATHJAX_A11Y_DISABLED` above for the runtime path
      // proof. (Top-level `MathJax.menuOptions` is silently ignored.)
      options: MATHJAX_A11Y_DISABLED,
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
