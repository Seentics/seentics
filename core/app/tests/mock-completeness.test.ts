import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/**
 * Every inline `mock.module` stub must export at least what the real module exports.
 *
 * Bun's module mocks are process-global: whichever registration resolves first *becomes*
 * that module for the entire run, including for files that never mention it. A stub
 * listing only the names its own file calls therefore breaks somebody else — and it does
 * so as `SyntaxError: Export named 'x' not found in module '<real file>'`, pointing at
 * the file that plainly does export it. Nothing in the message names the stub, and the
 * failure only appears once load order shifts, so it typically arrives with an unrelated
 * change.
 *
 * That went wrong five separate times before this check existed: `collect-handlers`
 * (missing a handler), `config` (missing `jwtSecret`), `platform/lib/s3` (missing
 * `putJpeg`), `infrastructure/idempotency` (missing `applyBatchOnceSql`), and the shared
 * `fake-db` (missing `sql.unsafe`). Each was found by a test in a different module
 * failing for reasons that had nothing to do with it.
 *
 * Only the inline-object form is checkable here. `mock.module(path, sharedFake)` passes a
 * variable, whose keys are not visible statically — those use the shared helpers in
 * `app/tests/helpers/`, which are maintained as complete on purpose.
 */

const CORE = resolve(import.meta.dir, "..", "..");

function testFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...testFiles(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** Slice from `start` (index of an opening bracket) to its match. */
function balanced(src: string, start: number, open: string, close: string): string {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === open) depth++;
    else if (src[i] === close) {
      depth--;
      if (depth === 0) return src.slice(start + 1, i);
    }
  }
  return "";
}

/** Top-level `key:` names of an object literal body, ignoring nested objects. */
function topLevelKeys(body: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let line = "";
  for (const ch of body) {
    if (ch === "{" || ch === "(" || ch === "[") depth++;
    else if (ch === "}" || ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      line = "";
      continue;
    }
    if (depth === 0) {
      line += ch;
      const m = /(?:^|\n)\s*([A-Za-z_$][\w$]*)\s*:/.exec(line);
      if (m && !keys.includes(m[1]!)) keys.push(m[1]!);
    }
  }
  return keys;
}

/** Runtime (non-type) export names of a module file. */
function realExports(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const names = new Set<string>();

  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([\w$]+)/gm)) {
    names.add(m[1]!);
  }
  // `export { a, b } from "./x"` and `export { a, b }` — skipping `export type { … }`.
  for (const m of src.matchAll(/^export\s+\{([^}]*)\}/gm)) {
    for (const part of m[1]!.split(",")) {
      const cleaned = part.trim().replace(/^type\s+/, "");
      if (!cleaned || part.trim().startsWith("type ")) continue;
      const name = cleaned.split(/\s+as\s+/).pop()!.trim();
      if (name) names.add(name);
    }
  }
  return [...names];
}

/** Every inline `mock.module("spec", () => ({ … }))` in the suite. */
function inlineStubs(): { file: string; spec: string; keys: string[]; target: string }[] {
  const found: { file: string; spec: string; keys: string[]; target: string }[] = [];

  for (const file of testFiles(join(CORE, "modules")).concat(
    testFiles(join(CORE, "platform")),
    testFiles(join(CORE, "app")),
    testFiles(join(CORE, "infrastructure")),
  )) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/mock\.module\(\s*["']([^"']+)["']\s*,\s*\(\)\s*=>\s*\(/g)) {
      const objStart = src.indexOf("{", m.index! + m[0].length - 1);
      if (objStart === -1) continue;

      // Resolve the specifier the way the runtime would, relative to the mocking file.
      const base = resolve(dirname(file), m[1]!);
      const target = [".ts", "/index.ts"].map((s) => base + s).find((p) => {
        try {
          return statSync(p).isFile();
        } catch {
          return false;
        }
      });
      if (!target) continue;

      found.push({
        file: relative(CORE, file),
        spec: m[1]!,
        keys: topLevelKeys(balanced(src, objStart, "{", "}")),
        target,
      });
    }
  }
  return found;
}

const STUBS = inlineStubs();

describe("mock.module stubs", () => {
  it("finds the inline stubs to check", () => {
    // Guards the parser: matching nothing would make every assertion below vacuous.
    expect(STUBS.length).toBeGreaterThan(5);
  });

  it("each one exports everything the real module does", () => {
    const gaps: string[] = [];

    for (const stub of STUBS) {
      const missing = realExports(stub.target).filter((n) => !stub.keys.includes(n));
      if (missing.length > 0) {
        gaps.push(
          `${stub.file} stubs "${stub.spec}" but omits: ${missing.join(", ")} ` +
            `— a global mock must be complete, or an unrelated file fails on the missing name`,
        );
      }
    }

    expect(gaps).toEqual([]);
  });
});
