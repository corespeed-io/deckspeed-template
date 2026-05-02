#!/usr/bin/env node
// Mirrors the vendored MathJax v3 distribution from node_modules into a
// per-app public/assets/vendor/mathjax directory so the loader at
// packages/deck-renderer/src/nodes/mathjaxLoader.ts can fetch
// /assets/vendor/mathjax/tex-svg.js (and the lazy-loaded font/component
// files it pulls in) from the same origin as the app.
//
// Usage: node scripts/copy-mathjax.mjs <relative-or-absolute-target-dir>
// Default target: ./public/assets/vendor/mathjax (relative to cwd)
//
// Idempotency: stores a sentinel file containing the resolved mathjax
// package version. Skips copy only if the sentinel matches AND tex-svg.js
// exists. Any version mismatch or partial copy triggers a full wipe + recopy
// — single-file mtime comparison can't catch interrupted copies or font
// upgrades that ship the same top-level entry name.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

const cwd = process.cwd();
const require = createRequire(join(cwd, "package.json"));

const targetArg = process.argv[2] ?? "./public/assets/vendor/mathjax";
const dest = resolve(cwd, targetArg);

let mathjaxPkgPath;
try {
  mathjaxPkgPath = require.resolve("mathjax/package.json", { paths: [cwd] });
} catch {
  console.error(
    "[copy-mathjax] mathjax package not resolvable from",
    cwd,
    "— add it as a dependency and reinstall.",
  );
  process.exit(1);
}
const mathjaxPkg = JSON.parse(readFileSync(mathjaxPkgPath, "utf8"));
const src = join(dirname(mathjaxPkgPath), "es5");
if (!existsSync(src)) {
  console.error(`[copy-mathjax] expected source missing: ${src}`);
  process.exit(1);
}

const sentinelPath = join(dest, ".version");
const expectedSentinel = `mathjax@${mathjaxPkg.version}`;
const entryFile = join(dest, "tex-svg.js");

if (existsSync(sentinelPath) && existsSync(entryFile)) {
  const current = readFileSync(sentinelPath, "utf8").trim();
  if (current === expectedSentinel) {
    console.log(
      `[copy-mathjax] up-to-date (${expectedSentinel}) at ${dest}, skipping`,
    );
    process.exit(0);
  }
  console.log(
    `[copy-mathjax] sentinel mismatch (have "${current}", want "${expectedSentinel}") — refreshing`,
  );
}

if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
writeFileSync(sentinelPath, `${expectedSentinel}\n`, "utf8");
console.log(`[copy-mathjax] copied ${expectedSentinel}: ${src} -> ${dest}`);
