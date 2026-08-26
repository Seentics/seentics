import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/**
 * The architectural rule, as a test.
 *
 * A module may import from another module's `interfaces/` and nothing else. Not its
 * services, not its repositories, not its routes, not its engines. Every cross-module
 * dependency is therefore an interface declared by one side and implemented by the
 * other, and the only other thing that crosses a module boundary at runtime is the
 * event bus.
 *
 * Worth enforcing mechanically because the violations it catches are the kind that
 * look harmless in review — one convenient import of a batch-insert function, one
 * `getSomeEngine()` call — and each one silently makes the importing module
 * untestable in isolation. That is exactly how the four that used to exist got in.
 *
 * A cycle between two modules' implementations would also be a compile error only by
 * luck; this makes it a test failure with a name attached.
 */

const CORE = resolve(import.meta.dir, "..", "..");
const MODULES = join(CORE, "modules");

/** Source files, excluding tests — a test may reach for whatever it needs to stub. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "tests" || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** Every relative `from "…"` specifier in a file, resolved to a core-relative path. */
function relativeImports(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const specs: string[] = [];
  for (const m of src.matchAll(/from\s+"(\.[^"]+)"/g)) {
    specs.push(relative(CORE, resolve(dirname(file), m[1]!)));
  }
  return specs;
}

const moduleNames = readdirSync(MODULES).filter((n) => statSync(join(MODULES, n)).isDirectory());

describe("module boundaries", () => {
  it("has modules to check", () => {
    expect(moduleNames.length).toBeGreaterThan(5);
  });

  for (const owner of moduleNames) {
    it(`${owner} imports only interfaces from its peers`, () => {
      const violations: string[] = [];

      for (const file of sourceFiles(join(MODULES, owner))) {
        for (const target of relativeImports(file)) {
          const parts = target.split("/");
          if (parts[0] !== "modules") continue;

          const peer = parts[1];
          if (peer === owner) continue;

          // `modules/<peer>/interfaces` and anything under it is the public surface.
          if (parts[2]?.startsWith("interfaces")) continue;

          violations.push(`${relative(CORE, file)} -> ${target}`);
        }
      }

      expect(violations).toEqual([]);
    });
  }

  it("keeps the composition root on init functions and interfaces", () => {
    const violations: string[] = [];

    for (const file of [...sourceFiles(join(CORE, "app")), join(CORE, "index.ts")]) {
      for (const target of relativeImports(file)) {
        const parts = target.split("/");
        if (parts[0] !== "modules") continue;

        if (parts[2]?.startsWith("interfaces")) continue;
        if (parts.length === 3 && parts[2] === "init") continue;

        // Auth is not yet a composed module: it has no `interfaces/` and its router
        // takes no dependencies, so the entry point still mounts it directly.
        if (parts[1] === "auth") continue;

        violations.push(`${relative(CORE, file)} -> ${target}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
