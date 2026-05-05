// URL safety helpers for user-controlled image/background sources.
//
// Threat model: the deck editor accepts arbitrary strings for image `src`
// and background image URLs, which can originate from:
//   - An agent writing into deck.json (trusted filesystem, malicious prompt)
//   - A user importing a deck from an untrusted source
//   - A shared deck link
//
// Attack vectors we block:
//   - `javascript:` / `vbscript:` URIs (XSS in <img onerror>, CSS url())
//   - `file:` URIs (local file read via `backgroundImage`)
//   - Unquoted `url(...)` CSS injection: breaking out with `)` or `;`
//
// Schemes we allow:
//   - `http:` / `https:` — normal remote resources
//   - `data:image/{png,jpeg,jpg,gif,webp,bmp,x-icon,avif}` — inline images
//   - `blob:` — object URLs from File API
//   - relative paths (`/foo.png`, `./foo.png`, `../foo.png`) — same-origin assets
//
// Anything else (including `javascript:`, `data:text/html`, `file:`) is
// rejected and render callers fall back to an empty/placeholder state.

const ALLOWED_DATA_MIME = /^data:image\/(png|jpe?g|gif|webp|bmp|x-icon|avif)[;,]/i;

export function isSafeImageUrl(raw: string): boolean {
  if (typeof raw !== "string") return false;
  const src = raw.trim();
  if (src === "") return false;

  // Relative paths / protocol-relative — safe.
  if (
    src.startsWith("/") ||
    src.startsWith("./") ||
    src.startsWith("../") ||
    src.startsWith("#")
  ) {
    return true;
  }

  // data: URIs — only image MIME types.
  if (src.toLowerCase().startsWith("data:")) {
    return ALLOWED_DATA_MIME.test(src);
  }

  // blob: — safe (same-origin by construction).
  if (src.toLowerCase().startsWith("blob:")) return true;

  // Anything else must be http(s).
  try {
    const u = new URL(src);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    // Not a valid absolute URL AND not a known safe prefix — reject.
    return false;
  }
}

/**
 * Return a `backgroundImage` CSS value for a user-provided src, or
 * `undefined` when the src is unsafe. Wraps the URL in double quotes and
 * escapes embedded quotes/backslashes so a crafted src cannot break out of
 * the `url(...)` function into neighbouring declarations.
 */
export function safeBackgroundImage(src: string): string | undefined {
  if (!isSafeImageUrl(src)) return undefined;
  // Reject ASCII control characters (newlines, nulls, form feeds, tabs…).
  // They can terminate a CSS string or break out of the `url(...)` function
  // even after escaping `\` and `"` — e.g. an embedded `\n` splits the
  // declaration, enabling injection of arbitrary CSS. No legitimate image
  // URL needs them, so drop the whole source rather than try to escape.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching control chars is the entire point of this defense
  if (/[\x00-\x1F\x7F]/.test(src)) return undefined;
  // Escape the two characters that can terminate a double-quoted CSS string.
  const escaped = src.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `url("${escaped}")`;
}

/**
 * Return a safe `<img src>` value, or an empty string when unsafe. An empty
 * src renders a broken-image icon, which is the correct UX for bad input
 * (visible to the author, no execution).
 */
export function safeImgSrc(src: string): string {
  return isSafeImageUrl(src) ? src : "";
}

// Patterns that must never appear in a gradient `background` value we
// set via inline style. All of these are legal in free-form CSS but
// open code-execution or exfil sinks:
//   - `url(` / `image-set(` / `-webkit-image-set(` — fetch arbitrary URLs,
//     bypassing `safeBackgroundImage`'s allowlist when a caller mislabels
//     the background as a gradient.
//   - `expression(` — legacy IE dynamic CSS (still historically dangerous
//     via nested frames / quirks mode).
//   - `@import` / `@charset` / `@namespace` — at-rules don't belong in
//     an inline `style.background` declaration; finding one means the
//     input is trying to escape the declaration.
//   - `</` — blunt defense against `</style>` breaking us out if the
//     value ever gets serialized into a stylesheet context.
const GRADIENT_FORBIDDEN = [
  "url(",
  "image-set(",
  "-webkit-image-set(",
  "expression(",
  "@import",
  "@charset",
  "@namespace",
  "</",
];

/**
 * Validate a user-supplied CSS gradient string for use in an inline
 * `style.background` declaration. Returns the input verbatim when it
 * passes, or `undefined` when it must be rejected.
 *
 * Strategy: a very conservative allow-list by rejection. We don't try to
 * parse CSS — we refuse anything that contains patterns with known sinks
 * (external resource loads, at-rules, tag-close sequences, control chars).
 * Legitimate gradients (`linear-gradient(...)`, `radial-gradient(...)`,
 * `conic-gradient(...)`, and `color`/`rgb`/`hsl`/`hex` stops) contain
 * none of these tokens.
 */
export function safeGradientCss(css: string): string | undefined {
  if (typeof css !== "string") return undefined;
  if (css.length === 0 || css.length > 1024) return undefined;
  // Control characters terminate a CSS declaration just like in
  // `safeBackgroundImage` — reject to prevent declaration splitting.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matching control chars is the entire point of this defense
  if (/[\x00-\x1F\x7F]/.test(css)) return undefined;
  const lower = css.toLowerCase();
  for (const needle of GRADIENT_FORBIDDEN) {
    if (lower.includes(needle)) return undefined;
  }
  return css;
}
