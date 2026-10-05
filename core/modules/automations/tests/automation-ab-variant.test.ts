import { describe, expect, it } from "bun:test";
import { pickVariant } from "../services/automation-evaluation.service";
import { walkGraph } from "../services/automation-graph-execution.service";

const test2 = { enabled: true, variants: [{ id: "a", weight: 1 }, { id: "b", weight: 1 }] };

describe("pickVariant", () => {
  it("puts a visitor in the same variant every time", () => {
    for (let i = 0; i < 50; i++) {
      const id = `visitor-${i}`;
      const first = pickVariant(test2, id, "auto-1");
      for (let n = 0; n < 5; n++) expect(pickVariant(test2, id, "auto-1")).toBe(first);
    }
  });

  it("splits visitors by the weights", () => {
    const weighted = { enabled: true, variants: [{ id: "a", weight: 3 }, { id: "b", weight: 1 }] };
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) counts[pickVariant(weighted, `v${i}`, "auto-1")!]!++;
    expect(counts.a! / 4000).toBeGreaterThan(0.71);
    expect(counts.a! / 4000).toBeLessThan(0.79);
  });

  it("assigns an even test about half and half", () => {
    let a = 0;
    for (let i = 0; i < 4000; i++) if (pickVariant(test2, `v${i}`, "auto-1") === "a") a++;
    expect(a / 4000).toBeGreaterThan(0.46);
    expect(a / 4000).toBeLessThan(0.54);
  });

  it("is independent between automations, so one test does not decide another", () => {
    let same = 0;
    for (let i = 0; i < 2000; i++) if (pickVariant(test2, `v${i}`, "auto-1") === pickVariant(test2, `v${i}`, "auto-2")) same++;
    expect(same / 2000).toBeGreaterThan(0.44);
    expect(same / 2000).toBeLessThan(0.56);
  });

  it("has no variant when the test is off or empty", () => {
    expect(pickVariant(undefined, "v", "a")).toBeNull();
    expect(pickVariant({ enabled: false, variants: [{ id: "a" }] }, "v", "a")).toBeNull();
    expect(pickVariant({ enabled: true, variants: [] }, "v", "a")).toBeNull();
  });
});

describe("a variant as a condition", () => {
  const graph = {
    entry: "pick",
    nodes: [
      { id: "pick", kind: "if", group: { operator: "AND", rules: [{ fact: "variant", operator: "equals", value: "b" }] } },
      { id: "show-b", kind: "action", action: { type: "show_toast", message: "B" } },
      { id: "show-a", kind: "action", action: { type: "show_toast", message: "A" } },
    ],
    edges: [
      { from: "pick", to: "show-b", branch: "true" },
      { from: "pick", to: "show-a", branch: "false" },
    ],
  };

  it("shows each group its own action", () => {
    const b = walkGraph(graph as never, { variant: "b" });
    const a = walkGraph(graph as never, { variant: "a" });
    expect((b.actions[0] as unknown as { message: string }).message).toBe("B");
    expect((a.actions[0] as unknown as { message: string }).message).toBe("A");
  });
});
