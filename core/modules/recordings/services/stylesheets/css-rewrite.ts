/**
 * Make every reference inside a stylesheet absolute, against the stylesheet's own URL.
 *
 * An archived copy is served from Seentics, not the site, so a relative `url(../font.woff2)`
 * or `@import "theme.css"` would otherwise resolve against the archive endpoint and miss.
 * Rewritten to absolute URLs they keep pointing at the site's origin, as they did when the
 * page was recorded.
 *
 * A small scanner rather than one regex, because the two places a reference can hide need
 * telling apart: `url(` inside a comment or a string is not a reference and must stay as
 * written, and a quoted `url("a)b.png")` contains a `)` that does not close it.
 *
 * Left exactly as written: `data:` and other absolute URLs with a scheme, fragment-only
 * references (`url(#gradient)` points into an SVG document, not at a file), empty values,
 * and anything that does not parse.
 */
export function absolutizeCssUrls(css: string, stylesheetUrl: string): string {
  let base: URL;
  try {
    base = new URL(stylesheetUrl);
  } catch {
    return css;
  }

  let out = "";
  let i = 0;
  const n = css.length;

  while (i < n) {
    const ch = css[i]!;

    // Comment: copied verbatim.
    if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      out += css.slice(i, stop);
      i = stop;
      continue;
    }

    // A string that is not part of url() or @import: copied verbatim.
    if (ch === '"' || ch === "'") {
      const stop = endOfString(css, i);
      out += css.slice(i, stop);
      i = stop;
      continue;
    }

    // url( … )
    if ((ch === "u" || ch === "U") && /^url\(/i.test(css.slice(i, i + 4)) && !isIdentChar(css[i - 1])) {
      const parsed = parseUrlFunction(css, i);
      if (parsed) {
        out += `url(${quoteCssUrl(resolveReference(parsed.value, base) ?? parsed.value, parsed.raw)})`;
        i = parsed.end;
        continue;
      }
    }

    // @import "…" — the url() form is handled by the branch above on the next pass.
    if (ch === "@" && /^@import\b/i.test(css.slice(i, i + 8))) {
      let j = i + 7;
      while (j < n && /\s/.test(css[j]!)) j++;
      const q = css[j];
      if (q === '"' || q === "'") {
        const stop = endOfString(css, j);
        const value = unescapeCss(css.slice(j + 1, stop - 1));
        const resolved = resolveReference(value, base);
        out += css.slice(i, j) + (resolved ? quoteCssString(resolved) : css.slice(j, stop));
        i = stop;
        continue;
      }
    }

    out += ch;
    i++;
  }
  return out;
}

function isIdentChar(c: string | undefined): boolean {
  return !!c && /[A-Za-z0-9_\-\\]/.test(c);
}

/** Index just past the string starting at `start` (its quote), honouring escapes. */
function endOfString(css: string, start: number): number {
  const quote = css[start];
  let j = start + 1;
  while (j < css.length) {
    const c = css[j]!;
    if (c === "\\") {
      j += 2;
      continue;
    }
    if (c === quote) return j + 1;
    // An unescaped newline ends a bad string in CSS; stop there rather than run on.
    if (c === "\n") return j;
    j++;
  }
  return css.length;
}

/** The URL inside `url(` at `start`, unescaped, and where the function ends. */
function parseUrlFunction(css: string, start: number): { value: string; raw: string; end: number } | null {
  let j = start + 4;
  while (j < css.length && /\s/.test(css[j]!)) j++;
  const q = css[j];
  let raw: string;
  let value: string;
  if (q === '"' || q === "'") {
    const stop = endOfString(css, j);
    raw = css.slice(j, stop);
    value = unescapeCss(css.slice(j + 1, stop - 1));
    j = stop;
    while (j < css.length && /\s/.test(css[j]!)) j++;
    if (css[j] !== ")") return null;
  } else {
    let k = j;
    while (k < css.length && css[k] !== ")") {
      if (css[k] === "\\") k++;
      // An unquoted url cannot contain these; it is not a url() we understand.
      else if (css[k] === "(" || css[k] === '"' || css[k] === "'") return null;
      k++;
    }
    if (k >= css.length) return null;
    raw = css.slice(j, k).trim();
    value = unescapeCss(raw);
    j = k;
  }
  return { value, raw, end: j + 1 };
}

/** Resolve one reference, or `null` when it must stay as written. */
function resolveReference(value: string, base: URL): string | null {
  const v = value.trim();
  if (!v || v.startsWith("#")) return null;
  // Already absolute (data:, https:, blob:, …): untouched. `//host/x` is relative.
  if (/^[a-z][a-z0-9+.\-]*:/i.test(v)) return null;
  try {
    return new URL(v, base).toString();
  } catch {
    return null;
  }
}

/** The url() argument for `value`: unchanged text when nothing was rewritten. */
function quoteCssUrl(value: string, raw: string): string {
  const original = raw.startsWith('"') || raw.startsWith("'") ? unescapeCss(raw.slice(1, -1)) : unescapeCss(raw);
  if (value === original) return raw;
  return quoteCssString(value);
}

function quoteCssString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\a ")}"`;
}

/** CSS escapes: `\` + up to six hex digits (and one optional space), or `\` + any char. */
function unescapeCss(s: string): string {
  if (!s.includes("\\")) return s;
  return s.replace(/\\(?:([0-9a-fA-F]{1,6})\s?|(\n)|(.))/g, (_m, hex: string | undefined, nl: string | undefined, ch: string | undefined) => {
    if (hex) {
      const cp = parseInt(hex, 16);
      return cp === 0 || cp > 0x10ffff ? "�" : String.fromCodePoint(cp);
    }
    if (nl) return "";
    return ch ?? "";
  });
}

/**
 * Whether a body served without a CSS content type is plausibly a stylesheet: not markup,
 * and with at least one rule block. A missing or `text/plain` type is common on CDNs; an
 * HTML error page served with 200 is common too, and must not be archived as CSS.
 */
export function looksLikeCss(text: string): boolean {
  const head = text.replace(/^﻿/, "").trimStart().slice(0, 512).toLowerCase();
  if (head.startsWith("<") || head.includes("<html") || head.includes("<!doctype")) return false;
  return /[{}]/.test(text.slice(0, 64 * 1024)) || /^@(import|charset)\b/.test(head);
}
