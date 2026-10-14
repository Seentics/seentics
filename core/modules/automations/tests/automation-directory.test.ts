import { describe, expect, it, mock } from "bun:test";
import { fakeDbModule } from "../../../app/tests/helpers/fake-db";

mock.module("../../../db", () => fakeDbModule());
const { AutomationDirectoryService } = await import("../services/automation-directory.service");

const A = "11111111-1111-4111-8111-111111111111";
const stored: Record<string, any> = {
  form: { definition: { graph: { entry: "n", nodes: [{ id: "n", kind: "action", action: { type: "show_modal", form: { destinations: [A] }, coupon: { code: "HI", description: "d" } } }], edges: [] } } },
  plain: { definition: { graph: { entry: "n", nodes: [{ id: "n", kind: "action", action: { type: "show_modal", title: "x" } }], edges: [] } } },
};
const directory = new AutomationDirectoryService({ findById: async (_w: string, id: string) => stored[id] ?? null } as any);

describe("AutomationDirectoryService", () => {
  it("reports where a form sends its submissions, from the stored definition", async () => {
    expect(await directory.routing("w", "form")).toEqual({ destinations: [A] });
    expect(await directory.routing("w", "plain")).toEqual({ destinations: null });
  });

  it("has no routing for an automation that is not on the website", async () => {
    expect(await directory.routing("w", "missing")).toBeNull();
    expect(await directory.rewards("w", "missing")).toBeNull();
  });

  it("still reads rewards, which need a form to be gated", async () => {
    expect(await directory.rewards("w", "form")).toEqual({ wheel: null, coupon: { code: "HI", description: "d" } });
    expect(await directory.rewards("w", "plain")).toBeNull();
  });
});
