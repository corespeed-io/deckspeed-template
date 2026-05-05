#!/usr/bin/env node
// Vendors the MathJax v4 distribution into a per-app
// public/assets/vendor/mathjax directory so the loader at
// packages/deck-renderer/src/nodes/mathjaxLoader.ts can fetch
// /assets/vendor/mathjax/tex-svg.js from the same origin as the app.
//
// v4 reorganized the npm package: bundles live at the package root (the
// v3 `es5/` subdir is gone) and fonts moved to separate `@mathjax/mathjax-*-font`
// packages declared as transitive deps of `mathjax`. This script reads
// `mathjax/package.json` to discover ALL declared font deps and vendors each
// one — no manual font allowlist. New v4.x patches that add additional fonts
// are auto-handled. Loader pins `loader.paths.fonts =
// "/assets/vendor/mathjax/fonts"` so MathJax looks up
// `<paths.fonts>/<font-package-name>/...` and stays same-origin under §C13.
//
// Usage:
//   node scripts/copy-mathjax.mjs [explicit-dest-path]
//
// Without an explicit dest, the script infers from <cwd>/package.json
// `name` starting with "@deckspeed/". If neither is present, exits
// non-zero with a clear message — by design, not a bug.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const cwd = process.cwd();
// Script location — used to resolve upstream packages even when cwd is
// outside any workspace (e.g., when invoked with an explicit dest from /tmp).
// Walking up from this dir reliably reaches the workspace's node_modules.
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(cwd, "package.json"));

// ---- Step 1: cwd-safe dest resolution -----------------------------------

const explicitArg = process.argv[2];
let dest;
if (explicitArg) {
  dest = resolve(cwd, explicitArg);
} else {
  let inferred = null;
  const cwdPkgPath = join(cwd, "package.json");
  if (existsSync(cwdPkgPath)) {
    try {
      const cwdPkg = JSON.parse(readFileSync(cwdPkgPath, "utf8"));
      if (typeof cwdPkg.name === "string" && cwdPkg.name.startsWith("@deckspeed/")) {
        inferred = resolve(cwd, "./public/assets/vendor/mathjax");
      }
    } catch {
      // fall through to fail-loud below
    }
  }
  if (!inferred) {
    console.error(
      "[copy-mathjax] Cannot infer dest. Run from a @deckspeed/ workspace " +
        "package, or pass explicit path as the first argument. cwd=" + cwd,
    );
    process.exit(1);
  }
  dest = inferred;
}

// ---- Step 2: resolve mathjax + enumerate its font deps ------------------

let mathjaxPkgPath;
try {
  mathjaxPkgPath = require.resolve("mathjax/package.json", { paths: [cwd, SCRIPT_DIR] });
} catch {
  console.error(
    "[copy-mathjax] mathjax package not resolvable from", cwd,
    "— add it as a dependency and reinstall.",
  );
  process.exit(1);
}
const mathjaxPkg = JSON.parse(readFileSync(mathjaxPkgPath, "utf8"));
if (!/^4\./.test(mathjaxPkg.version)) {
  console.error(
    `[copy-mathjax] mathjax version ${mathjaxPkg.version} is not 4.x; ` +
      "this script targets v4 exclusively (no v3 fallback).",
  );
  process.exit(1);
}

// Enumerate every font package mathjax declares — runtime, peer, optional.
// MathJax may try to load any of these; all must be vendored to satisfy §C13.
//
// Two known npm naming patterns under @mathjax:
//   `@mathjax/mathjax-<x>-font`           (font packages — newcm, stix2, …)
//   `@mathjax/mathjax-<x>-font-extension` (TeX extensions — mhchem, bboldx, …)
//
// This script handles fonts only. If MathJax ever declares an extension as a
// dep, we want to fail-loud rather than silently skip it (which would re-open
// the §C13 CDN-fallback hole). Slug character class is tightened to
// `[a-z0-9]+(?:-[a-z0-9]+)*` — defends against typosquats / path traversal.
const allMathjaxScoped = [
  ...Object.keys(mathjaxPkg.dependencies ?? {}),
  ...Object.keys(mathjaxPkg.peerDependencies ?? {}),
  ...Object.keys(mathjaxPkg.optionalDependencies ?? {}),
].filter((d) => d.startsWith("@mathjax/mathjax-"));
const FONT_NAME = /^@mathjax\/mathjax-[a-z0-9]+(?:-[a-z0-9]+)*-font$/;
const EXTENSION_NAME =
  /^@mathjax\/mathjax-[a-z0-9]+(?:-[a-z0-9]+)*-font-extension$/;
const fontDepNames = allMathjaxScoped.filter((d) => FONT_NAME.test(d));
const extensionDepNames = allMathjaxScoped.filter((d) => EXTENSION_NAME.test(d));

if (extensionDepNames.length > 0) {
  console.error(
    `[copy-mathjax] mathjax@${mathjaxPkg.version} declares font-extension ` +
      `dependencies this script doesn't yet handle: ${extensionDepNames.join(", ")}. ` +
      "Extensions ship a different layout than fonts (no svg/ dir, no " +
      "tex-mml-svg-<slug>.js alias) and need explicit per-extension copy " +
      "logic. Pin a mathjax version without these deps, or extend this " +
      "script to vendor them — silent skip would re-open the §C13 " +
      "CDN-fallback hole.",
  );
  process.exit(1);
}

if (fontDepNames.length === 0) {
  console.error(
    `[copy-mathjax] mathjax@${mathjaxPkg.version} declares no @mathjax/mathjax-*-font ` +
      "dependencies. Refusing to vendor blind — without a font, MathJax falls back " +
      "to a CDN URL (§C13 violation). Pin a mathjax version that ships with a font dep.",
  );
  process.exit(1);
}

// Resolve each declared font package on disk.
//   slug: "newcm" (used to derive expected entry filenames and for sentinel)
//   destDir: package name without the @mathjax/ scope (matches MathJax's own
//            runtime path-resolution convention: <paths.fonts>/<package-name>/)
const fontPackages = fontDepNames.map((depName) => {
  let pkgPath;
  try {
    pkgPath = require.resolve(`${depName}/package.json`, {
      paths: [cwd, SCRIPT_DIR],
    });
  } catch {
    console.error(
      `[copy-mathjax] ${depName} declared by mathjax@${mathjaxPkg.version} but ` +
        "not resolvable in node_modules. Reinstall, or remove from mathjax pin.",
    );
    process.exit(1);
  }
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  // depName: "@mathjax/mathjax-newcm-font" → slug "newcm" → tex-mml-svg-mathjax-<slug>.js
  const slug = depName.replace(/^@mathjax\/mathjax-/, "").replace(/-font$/, "");
  const destDirName = depName.replace(/^@mathjax\//, "");
  return { depName, pkg, root: dirname(pkgPath), slug, destDirName };
});

// ---- Step 3: required-entry presence check on disk -----------------------

// Verify the things we're about to copy actually exist. We deliberately do
// NOT check the upstream `files` manifest — a benign 4.1.x patch that adds
// e.g. CHANGELOG.md would otherwise crash the script even though every entry
// we depend on is still present. The actual invariant is "the things we copy
// exist," not "the manifest matches a hand-written list."
const REQUIRED_MATHJAX_ENTRIES = [
  "tex-svg.js", // primary bundle entry the loader fetches
  "a11y", "adaptors", "input", "output", "sre", "ui",
];

function assertOnDiskExists(label, root, entries) {
  for (const x of entries) {
    if (!existsSync(join(root, x))) {
      console.error(
        `[copy-mathjax] ${label} missing required entry "${x}" on disk at ` +
          `${join(root, x)}. (Upstream package may have reorganized.)`,
      );
      process.exit(1);
    }
  }
}
assertOnDiskExists("mathjax", dirname(mathjaxPkgPath), REQUIRED_MATHJAX_ENTRIES);
// Each font ships at minimum: a `svg.js` runtime entry and a
// `tex-mml-svg-mathjax-<slug>.js` alias bundle. Most fonts ALSO ship a `svg/`
// dir holding lazy-loaded font-subset chunks — but not all (e.g.,
// @mathjax/mathjax-tex-font@4.1.2 ships only `svg.js` + the alias). So `svg/`
// is treated as optional at copy time (see Step 7), not required here.
for (const fp of fontPackages) {
  assertOnDiskExists(fp.destDirName, fp.root, [
    "svg.js",
    `tex-mml-svg-mathjax-${fp.slug}.js`,
  ]);
}

// ---- Step 4: sentinel short-circuit --------------------------------------

const sentinelPath = join(dest, ".version");
const fontSentinelParts = fontPackages
  .map((fp) => `${fp.destDirName}@${fp.pkg.version}`)
  .sort()
  .join("+");
const expectedSentinel = `mathjax@${mathjaxPkg.version}+${fontSentinelParts}`;
const mathjaxEntry = join(dest, "tex-svg.js");
const fontEntries = fontPackages.map((fp) =>
  join(dest, "fonts", fp.destDirName, "svg.js"),
);

if (
  existsSync(sentinelPath) &&
  existsSync(mathjaxEntry) &&
  fontEntries.every(existsSync)
) {
  const current = readFileSync(sentinelPath, "utf8").trim();
  if (current === expectedSentinel) {
    console.log(`[copy-mathjax] up-to-date (${expectedSentinel}) at ${dest}, skipping`);
    process.exit(0);
  }
  console.log(
    `[copy-mathjax] sentinel mismatch (have "${current}", want "${expectedSentinel}") — refreshing`,
  );
}

// ---- Step 5: wipe + recreate dest ----------------------------------------

if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

// ---- Step 6: copy mathjax (root-level files + 6 dirs) --------------------

const mathjaxRoot = dirname(mathjaxPkgPath);
const MATHJAX_DIRS = ["a11y", "adaptors", "input", "output", "sre", "ui"];

function safeFilter(srcRoot) {
  return (s) => {
    const real = realpathSync(s);
    const rel = relative(srcRoot, real);
    return !rel.startsWith("..") && !isAbsolute(rel);
  };
}

// Root-level JS bundles (matches *.js, *.mjs, *.cjs from `files` field).
for (const entry of readdirSync(mathjaxRoot)) {
  if (/\.(js|mjs|cjs)$/.test(entry)) {
    cpSync(join(mathjaxRoot, entry), join(dest, entry), {
      dereference: true,
      filter: safeFilter(mathjaxRoot),
    });
  }
}
for (const subdir of MATHJAX_DIRS) {
  const src = join(mathjaxRoot, subdir);
  if (!existsSync(src)) {
    console.error(`[copy-mathjax] expected mathjax/${subdir} not found at ${src}`);
    process.exit(1);
  }
  cpSync(src, join(dest, subdir), {
    recursive: true,
    dereference: true,
    filter: safeFilter(mathjaxRoot),
  });
}

// ---- Step 7: copy each declared font (curated SVG subset) ----------------

for (const fp of fontPackages) {
  const fontDest = join(dest, "fonts", fp.destDirName);
  mkdirSync(fontDest, { recursive: true });
  // `svg.js` and the `tex-mml-svg-mathjax-<slug>.js` alias are required and
  // already presence-checked in Step 3. `svg/` (lazy-loaded font-subset
  // chunks) ships in most fonts but not all — copy when present, skip when
  // absent.
  const requiredEntries = ["svg.js", `tex-mml-svg-mathjax-${fp.slug}.js`];
  const optionalEntries = ["svg"];
  for (const entry of [...requiredEntries, ...optionalEntries]) {
    const src = join(fp.root, entry);
    if (!existsSync(src)) continue; // optional entries skip cleanly
    cpSync(src, join(fontDest, entry), {
      recursive: true,
      dereference: true,
      filter: safeFilter(fp.root),
    });
  }
}

// ---- Step 8: write sentinel ----------------------------------------------

writeFileSync(sentinelPath, `${expectedSentinel}\n`, "utf8");
console.log(`[copy-mathjax] copied ${expectedSentinel} -> ${dest}`);
