/**
 * Make parsed JSON storable as Postgres `jsonb` and `text`, in place.
 *
 * JSON can carry two things Postgres refuses: the NUL character (`\u0000`) and an unpaired
 * UTF-16 surrogate. Either one, anywhere in a batch, makes the whole insert fail. Ingest
 * merges every visitor of a site into one batch per flush, so a single anonymous event
 * carrying `"\u0000"` used to fail that batch on every retry until it was dropped — with
 * everyone else's events in it. NUL is removed; a lone surrogate becomes U+FFFD, the way
 * a browser would display it. Object keys are cleaned too.
 *
 * Mutates and returns `value`. Strings that are already clean are left alone, so the cost
 * on ordinary traffic is one regex test per string.
 */
const UNSAFE = /[\u0000\uD800-\uDFFF]/;
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function cleanString(s: string): string {
  if (!UNSAFE.test(s)) return s;
  return s.replace(/\u0000/g, "").replace(LONE_SURROGATE, "\uFFFD");
}

export function makeJsonbSafe<T>(value: T): T {
  return clean(value, 0) as T;
}

// Deep enough for any real payload; JSON.parse output past this is left as is rather
// than recursed into without bound.
const MAX_DEPTH = 64;

function clean(value: unknown, depth: number): unknown {
  if (typeof value === "string") return cleanString(value);
  if (value === null || typeof value !== "object" || depth > MAX_DEPTH) return value;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = clean(value[i], depth + 1);
    return value;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const cleaned = clean(obj[key], depth + 1);
    const safeKey = cleanString(key);
    if (safeKey !== key) {
      delete obj[key];
      obj[safeKey] = cleaned;
    } else {
      obj[key] = cleaned;
    }
  }
  return obj;
}
