import { createHash } from "node:crypto";

/**
 * Grouping key for a frontend error.
 *
 * Computed here rather than in the tracker so the rule can be changed without waiting
 * for every customer's cached bundle to expire — and so a page cannot choose its own
 * grouping. The cost is that changing it splits existing groups; a fingerprint is a
 * stored value, not a derived one.
 *
 * What gets normalised away is the whole design. The same fault reaches us with a
 * different message every time — ids, URLs, quoted values, minified variable names all
 * vary between two occurrences of one bug. Group on the raw text and a single broken
 * checkout produces four thousand groups nobody reads; normalise too hard and unrelated
 * faults collapse into one useless bucket. These rules target the things that are
 * *obviously* per-occurrence.
 */

/** Ordered, and that matters — the URL rule must run before the numeric one eats its port and path segments. */
const NOISE: Array<[RegExp, string]> = [
  // Absolute URLs, including the blob: and webpack-internal: forms bundlers emit.
  [/\b(?:https?|blob|file|webpack(?:-internal)?):\/\/[^\s'")]+/gi, "<url>"],
  // UUIDs before the generic hex rule, which would otherwise chew them in pieces.
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>"],
  // Long hex runs: content hashes, object ids, minified chunk names.
  [/\b[0-9a-f]{16,}\b/gi, "<hex>"],
  // Quoted values — `Cannot read properties of undefined (reading 'basket')` keeps its
  // shape, and the property name is what differs between two calls to the same broken line.
  [/'[^']{0,64}'/g, "'<v>'"],
  [/"[^"]{0,64}"/g, '"<v>"'],
  // Any remaining number. Last, deliberately.
  [/\b\d+\b/g, "<n>"],
];

/**
 * Strip the per-occurrence detail out of a message.
 *
 * Exported for the tests, which are the only real specification of what "the same error"
 * means here.
 */
export function normalizeErrorMessage(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  for (const [re, to] of NOISE) s = s.replace(re, to);
  // Collapse whitespace last: several rules above can leave runs behind.
  return s.replace(/\s+/g, " ").slice(0, 500);
}

/**
 * Filename without the cache-busting parts, so a redeploy does not re-group every error.
 *
 * `/_next/static/chunks/main-4f2b9c.js` and the same file after the next build are the
 * same source. Without this every deploy would present the entire backlog as new.
 */
export function normalizeErrorSource(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  try {
    // Keep the path, drop origin and query — the same bundle served from a CDN and from
    // the origin is one file, and `?v=` is nothing but a cache buster.
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = new URL(s).pathname;
  } catch {
    /* not a URL — use it as given */
  }
  s = s.split(/[?#]/)[0] ?? s;
  // Content hashes in the filename: `main-4f2b9c.js`, `main.4f2b9c.chunk.js`.
  s = s.replace(/[-.][0-9a-f]{6,}(?=\.[a-z]+$|\.)/gi, ".<hash>");
  return s.slice(0, 300);
}

/**
 * The stored grouping key.
 *
 * `kind` is included so a thrown `TypeError` and an unhandled rejection carrying the same
 * text stay apart: they are usually different faults with different fixes, and merging
 * them would hide one behind the other.
 *
 * The line number is deliberately absent. It moves whenever anything above it on the
 * line is edited, and including it would re-group a fault on every unrelated change to
 * the same file.
 */
export function errorFingerprint(input: {
  kind: string;
  message: string;
  sourceFile: string;
}): string {
  const parts = [
    (input.kind || "error").toLowerCase(),
    normalizeErrorMessage(input.message),
    normalizeErrorSource(input.sourceFile),
  ];
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}
