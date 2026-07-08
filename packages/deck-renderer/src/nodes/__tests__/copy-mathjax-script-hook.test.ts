// packages/deck-renderer/src/nodes/__tests__/copy-mathjax-script-hook.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Decision 5 of the MathJax v4 upgrade spec: we deliberately do NOT add a
// `postinstall` hook; instead we rely on the dev/build script chain
// (`node ../../scripts/copy-mathjax.mjs && vite ...`) to trigger the vendor
// copy. This test asserts both package.json files still wire that chain so
// a future refactor can't silently drop it.

const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..", "..");

const TARGETS: { path: string; scripts: string[] }[] = [
  {
    path: "apps/web/package.json",
    scripts: ["dev", "build", "build:staging", "build:production"],
  },
  {
    path: "templates/package.json",
    scripts: ["dev", "start", "build"],
  },
];

describe("copy-mathjax script chain (Decision 5 guard)", () => {
  for (const target of TARGETS) {
    describe(target.path, () => {
      const pkg = JSON.parse(
        readFileSync(resolve(REPO_ROOT, target.path), "utf8"),
      );
      for (const scriptName of target.scripts) {
        it(`${scriptName} chains copy-mathjax`, () => {
          const script = pkg.scripts?.[scriptName];
          expect(script, `${target.path}:scripts.${scriptName} missing`).toBeDefined();
          expect(
            script,
            `${target.path}:scripts.${scriptName} = "${script}" must contain "copy-mathjax"`,
          ).toContain("copy-mathjax");
        });
      }
    });
  }
});
