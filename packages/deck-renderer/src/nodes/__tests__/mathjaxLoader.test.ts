import { beforeEach, describe, expect, it, vi } from "vitest";

interface ConfiguredMathJax {
  svg?: { linebreaks?: { inline?: boolean } };
  startup: { ready: () => void };
}

describe("mathjaxLoader", () => {
  beforeEach(() => {
    vi.resetModules();
    document.head.innerHTML = "";
    delete (window as unknown as { MathJax?: unknown }).MathJax;
  });

  it("disables automatic SVG line breaks for inline math", async () => {
    const { loadMathJax } = await import("../mathjaxLoader");

    const pending = loadMathJax();
    const mathJax = (window as unknown as { MathJax: ConfiguredMathJax })
      .MathJax;

    expect(mathJax.svg?.linebreaks?.inline).toBe(false);

    mathJax.startup.ready();
    await expect(pending).resolves.toBe(mathJax);
  });
});
