import { describe, it, expect } from "bun:test";
import { proposeAutomationTool } from "../tools/propose-automation.tool";
import { ToolRegistry } from "../tools/registry";
import type { ToolContext } from "../tools/tool.types";
import { AutomationDraftValidatorService } from "../../automations/lib/draft-validator";

/*
 * The real validator, not a stub. The point of the tool is that a draft it approves
 * would actually save, and a stub would prove nothing about that.
 */
const validator = new AutomationDraftValidatorService();

const CTX: ToolContext = { websiteId: "11111111-1111-4111-8111-111111111111", userId: "u1" };
const tool = proposeAutomationTool(validator, validator.vocabulary());
const registry = new ToolRegistry([tool]);

const run = (args: unknown) => registry.run("propose_automation", args, CTX);
const ok = (r: Awaited<ReturnType<typeof run>>) => {
  if (!r.ok) throw new Error(`expected success, got: ${r.error}`);
  return (r.data as { proposal: any }).proposal;
};

describe("propose_automation", () => {
  it("writes nothing — it returns a proposal", async () => {
    // The whole security model rests on this: the tool has no repository, no database
    // handle, and nothing to write with.
    const p = ok(await run({ name: "Exit offer", trigger: "exit_intent", action: "show_modal" }));
    expect(p.operation).toBe("create");
    expect(p.resource).toBe("automation");
  });

  it("drafts are always inactive", async () => {
    // Approving a draft is not the same as meaning it to start running against live
    // visitors this second.
    const p = ok(await run({ name: "Exit offer", trigger: "exit_intent", action: "show_modal" }));
    expect(p.payload.status).toBe("draft");
  });

  it("produces a definition the real create endpoint would accept", async () => {
    const p = ok(await run({ name: "Exit offer", trigger: "exit_intent", action: "show_modal" }));
    expect(p.payload.definition.triggers).toEqual([{ type: "exit_intent" }]);
    expect(p.payload.definition.graph.entry).toBe("n_action");
  });

  it("wires a delay ahead of the action when asked", async () => {
    const p = ok(await run({
      name: "Late nudge", trigger: "page_view", action: "show_toast", delaySeconds: 30,
    }));
    const g = p.payload.definition.graph;
    expect(g.entry).toBe("n_delay");
    expect(g.edges).toEqual([{ from: "n_delay", to: "n_action" }]);
  });

  it("flags a webhook as reaching outside the product", async () => {
    const p = ok(await run({
      name: "Notify CRM", trigger: "custom_event", action: "webhook",
      actionConfig: { url: "https://hooks.example.com/x", method: "POST" },
    }));
    expect(p.summary.hasExternalEffect).toBe(true);
  });

  it("flags a redirect too", async () => {
    const p = ok(await run({
      name: "Send to offer", trigger: "exit_intent", action: "redirect",
      actionConfig: { url: "https://shop.test/offer" },
    }));
    expect(p.summary.hasExternalEffect).toBe(true);
  });

  it("does not flag an on-page action", async () => {
    const p = ok(await run({ name: "Nudge", trigger: "exit_intent", action: "show_modal" }));
    expect(p.summary.hasExternalEffect).toBe(false);
  });

  it("surfaces the destination in the summary the approver reads", async () => {
    // The confirmation screen has to show where a webhook actually posts, and it is
    // built from the validated payload rather than from the model's prose.
    const p = ok(await run({
      name: "Notify", trigger: "custom_event", action: "webhook",
      actionConfig: { url: "https://hooks.example.com/secret", method: "POST" },
    }));
    expect(p.summary.lines.join("\n")).toContain("https://hooks.example.com/secret");
  });

  it("says the draft will not run", async () => {
    const p = ok(await run({ name: "N", trigger: "exit_intent", action: "show_modal" }));
    expect(p.summary.lines.join(" ")).toContain("will not run until you enable it");
  });

  describe("refusals", () => {
    it("rejects a trigger the product does not have", async () => {
      const r = await run({ name: "X", trigger: "mind_reading", action: "show_modal" });
      expect(r.ok).toBe(false);
    });

    it("rejects an action type outside the closed set", async () => {
      // `script` is the one that matters: arbitrary JS on a customer's site. It is not a
      // valid action anywhere in the product, and the enum is what keeps it that way.
      const r = await run({ name: "X", trigger: "page_view", action: "script" });
      expect(r.ok).toBe(false);
    });

    it("rejects a missing name rather than inventing one", async () => {
      expect((await run({ trigger: "page_view", action: "show_modal" })).ok).toBe(false);
    });

    it("rejects a delay beyond the allowed budget", async () => {
      const r = await run({
        name: "X", trigger: "page_view", action: "show_modal", delaySeconds: 999_999,
      });
      expect(r.ok).toBe(false);
    });

    it("ignores a website id if the model supplies one", async () => {
      // Not an error — the schema strips it. What matters is that it cannot reach the
      // payload, because the tool never reads one; the context supplies it.
      const p = ok(await run({
        name: "X", trigger: "page_view", action: "show_modal",
        websiteId: "22222222-2222-4222-8222-222222222222",
      }));
      expect(JSON.stringify(p)).not.toContain("22222222");
    });

    it("returns the refusal instead of throwing", async () => {
      // The model should get a message it can act on; an exception would end the turn.
      const r = await run({ name: "X", trigger: "nope", action: "show_modal" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("Invalid arguments");
    });
  });
});
