// packages/deck-renderer/src/nodes/__tests__/copy-mathjax-script.test.ts
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Behavior tests for the v4-rewritten templates/scripts/copy-mathjax.mjs.
// Invokes the canonical script in subprocesses with controlled cwd/argv
// to validate the spec's Step 1 (cwd-safe dest resolution + fail-loud
// branch).

const REPO_ROOT = resolve(__dirname, "..", "..", "..", "..", "..");
const SCRIPT = resolve(REPO_ROOT, "templates/scripts/copy-mathjax.mjs");

function runScript(opts: {
  cwd: string;
  args?: string[];
}): { code: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync("node", [SCRIPT, ...(opts.args ?? [])], {
      cwd: opts.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return {
      code: err.status ?? 1,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
    };
  }
}

describe("copy-mathjax script (v4)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "copy-mathjax-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("succeeds when run from apps/web (workspace package)", () => {
    const result = runScript({ cwd: resolve(REPO_ROOT, "apps/web") });
    expect(result.code).toBe(0);
    expect(
      existsSync(
        resolve(REPO_ROOT, "apps/web/public/assets/vendor/mathjax/tex-svg.js"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        resolve(
          REPO_ROOT,
          "apps/web/public/assets/vendor/mathjax/fonts/mathjax-newcm-font/svg.js",
        ),
      ),
    ).toBe(true);
  });

  it("succeeds when run from templates (workspace package)", () => {
    const result = runScript({ cwd: resolve(REPO_ROOT, "templates") });
    expect(result.code).toBe(0);
    expect(
      existsSync(
        resolve(
          REPO_ROOT,
          "templates/public/assets/vendor/mathjax/tex-svg.js",
        ),
      ),
    ).toBe(true);
  });

  it("fails loud with clear message when cwd has no @deckspeed/ package.json and no arg", () => {
    const result = runScript({ cwd: tmpDir });
    expect(result.code).not.toBe(0);
    expect(result.stderr + result.stdout).toMatch(/Cannot infer dest/i);
  });

  it("succeeds when run from non-workspace cwd with explicit arg", () => {
    const explicitDest = join(tmpDir, "vendored-mathjax");
    const result = runScript({ cwd: tmpDir, args: [explicitDest] });
    expect(result.code).toBe(0);
    expect(existsSync(join(explicitDest, "tex-svg.js"))).toBe(true);
    expect(
      existsSync(join(explicitDest, "fonts/mathjax-newcm-font/svg.js")),
    ).toBe(true);
  });
});
