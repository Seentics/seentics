/**
 * Comparing an endpoint's numbers with a reference query's, and reporting the result.
 * Shared by every feature's benchmark so they all hold the same tolerances.
 */
import { RESULTS_DIR } from "./config";

/**
 * Allowed difference for exact counts. Endpoint and reference run moments apart, so on
 * a site taking live traffic a few events may cross the window edge between them.
 */
export const DRIFT = (n: number) => Math.max(5, Math.ceil(Math.abs(n) * 0.0005));

/**
 * An expected unique-visitor count. The rollups estimate these with HyperLogLog (~0.6%
 * standard error, exact on small counts), so they get a tolerance of three standard
 * errors — at two, a run of 40 checks fails one by chance. Every other number is held
 * to DRIFT.
 */
export type Uniques = { uniques: number };
export const U = (n: number): Uniques => ({ uniques: n });
// log2m 15 (core/db/sql/032): ~0.6% standard error, within ±0.5% of exact on most
// counts — but the extension's estimator (plain HyperLogLog, no HLL++ bias
// correction) reads up to ~2.1% high where a count is 2.5–5× the register count,
// ~80k–160k visitors: measured on /about at 81,104 exact → 82,790, which a direct
// sketch of the same rows gives too. 2.5% holds that and nothing worse. It was 3.5%
// at log2m 13, loose enough that a steady 2–4% undercount mostly passed.
const HLL_TOLERANCE = (n: number) => Math.max(3, Math.ceil(Math.abs(n) * 0.025));

/** Structural equality, numbers within DRIFT and `U(...)` values within HLL_TOLERANCE. */
export const close = (a: unknown, b: unknown): boolean =>
  a !== null && typeof a === "object" && "uniques" in (a as object)
    ? typeof b === "number" && Math.abs((a as Uniques).uniques - b) <= HLL_TOLERANCE((a as Uniques).uniques)
  : typeof a === "number" && typeof b === "number" ? Math.abs(a - b) <= DRIFT(a)
  : Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x, i) => close(x, b[i]))
  : a !== null && b !== null && typeof a === "object" && typeof b === "object"
    ? Object.keys(a as object).length === Object.keys(b as object).length &&
      Object.keys(a as object).every((k) => close((a as any)[k], (b as any)[k]))
  : a === b;

export type Check = { endpoint: string; check: string; ok: boolean; expected?: unknown; actual?: unknown };

/** Collects checks; `eq` compares with `close`, `rule` records a plain pass/fail. */
export function checker() {
  const out: Check[] = [];
  return {
    out,
    eq: (endpoint: string, check: string, expected: unknown, actual: unknown) =>
      out.push({ endpoint, check, ok: close(expected, actual), expected, actual }),
    near: (endpoint: string, check: string, expected: number, actual: number, tol = 0.15) =>
      out.push({ endpoint, check, ok: typeof actual === "number" && Math.abs(expected - actual) <= tol, expected: +expected.toFixed(2), actual }),
    rule: (endpoint: string, check: string, ok: boolean, actual?: unknown) => out.push({ endpoint, check, ok, actual }),
  };
}

/** Prints the failed checks, expected against actual, truncated to a readable width. */
export function printFailures(checks: Check[]): number {
  const failed = checks.filter((c) => !c.ok);
  console.log(`  checks: ${checks.length - failed.length} ok, ${failed.length} failed`);
  for (const f of failed) {
    console.log(`   ✗ ${f.endpoint}: ${f.check}`);
    if (f.expected !== undefined) console.log(`       expected ${JSON.stringify(f.expected).slice(0, 400)}`);
    console.log(`       actual   ${JSON.stringify(f.actual).slice(0, 400)}`);
  }
  return failed.length;
}

/** Writes a run's full results to results/<name>-<time>.json and returns the path. */
export async function saveResults(name: string, data: unknown): Promise<string> {
  const path = `${RESULTS_DIR}${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await Bun.write(path, JSON.stringify(data, null, 2));
  return path;
}
