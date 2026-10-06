/**
 * Which customer-written regular expressions the server may run.
 *
 * Automation conditions and page-view triggers run a pattern a customer wrote against text a
 * visitor sent, in JavaScript's backtracking engine, on the one thread that serves every
 * customer. A pattern like `^(a|aa)+$` against thirty-odd `a`s followed by anything else
 * does not return for hours, and nothing can interrupt a regular expression once it has
 * started. The earlier check looked for a quantifier written directly after another and
 * missed that one, and the page-view trigger had no check at all.
 *
 * So the pattern is held to a shape that cannot blow up, and the text it meets is bounded:
 *
 *   - no back-references and no look-around (the constructs that make matching exponential or
 *     hard to reason about);
 *   - no quantifier on a group — `(…)*`, `(…)+`, `(…){2,}` — which is where nested repetition
 *     comes from. `?` is allowed: it repeats at most once;
 *   - at most `MAX_REPEATS` unbounded repeats in all. Each adds a factor of the text's length
 *     to the worst case, and with the text bounded by `MAX_TEXT_CHARS` that stays in the
 *     millions of steps, not the astronomical.
 */
export const MAX_PATTERN_CHARS = 200;
export const MAX_TEXT_CHARS = 256;
const MAX_REPEATS = 3;
/** `{n,m}` counts as unbounded past this many repeats. */
const BOUNDED_REPEAT_MAX = 10;

export function isLinearSafePattern(pattern: string): boolean {
  if (pattern.length > MAX_PATTERN_CHARS) return false;
  if (/\\[1-9]|\\k</.test(pattern)) return false;
  if (/\(\?(?:=|!|<=|<!)/.test(pattern)) return false;

  let repeats = 0;
  let inClass = false;
  /** The previous token closed a group, so a repeat now would repeat the whole group. */
  let afterGroup = false;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === "\\") { i++; afterGroup = false; continue; }
    if (inClass) {
      if (ch === "]") inClass = false;
      continue;
    }
    if (ch === "[") { inClass = true; afterGroup = false; continue; }
    if (ch === ")") { afterGroup = true; continue; }

    let repeat: "none" | "bounded" | "unbounded" = "none";
    if (ch === "*" || ch === "+") repeat = "unbounded";
    else if (ch === "{") {
      const m = /^\{(\d+)(?:(,)(\d*))?\}/.exec(pattern.slice(i));
      if (m) {
        const min = Number(m[1]);
        const max = m[2] ? (m[3] === "" ? Infinity : Number(m[3])) : min;
        repeat = min > BOUNDED_REPEAT_MAX || max > BOUNDED_REPEAT_MAX ? "unbounded" : "bounded";
        i += m[0].length - 1;
      }
    }
    // A repeat of a group is where nested repetition comes from: `(a|aa)+`, `(x*y){2,}`.
    // `?` (at most once) is not counted, so `(a|b)?` is fine.
    if (repeat !== "none" && afterGroup) return false;
    if (repeat === "unbounded" && ++repeats > MAX_REPEATS) return false;
    afterGroup = false;
  }
  return !inClass;
}

/** Runs `pattern` on at most `MAX_TEXT_CHARS` of `text`; false for a pattern outside the safe shape. */
export function safeRegexTest(pattern: string, text: string): boolean {
  if (!isLinearSafePattern(pattern)) return false;
  try {
    return new RegExp(pattern).test(text.slice(0, MAX_TEXT_CHARS));
  } catch {
    return false;
  }
}
