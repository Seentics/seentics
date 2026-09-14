import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { runAgent } from "../services/agent/agent-loop";
import { ToolRegistry } from "../tools/registry";
import { isObviouslyOffTopic } from "../services/agent/scope";
import type { AiTool, ToolContext } from "../tools/tool.types";
import type { ChatTurn, ToolCallingLlmClient } from "../interfaces/llm-client.interface";

const CTX: ToolContext = { websiteId: "11111111-1111-4111-8111-111111111111", userId: "u1" };

/** Replays a scripted sequence of turns and records what it was asked. */
function fakeLlm(turns: Partial<ChatTurn>[]): ToolCallingLlmClient & { calls: number } {
  let i = 0;
  return {
    supportsTools: true,
    calls: 0,
    async complete() { throw new Error("unused"); },
    async classify() { return ""; },
    async chat() {
      const t = turns[Math.min(i++, turns.length - 1)] ?? {};
      (this as { calls: number }).calls = i;
      return {
        text: t.text ?? "", toolCalls: t.toolCalls ?? [],
        inputTokens: t.inputTokens ?? 10, outputTokens: t.outputTokens ?? 5,
      };
    },
  } as ToolCallingLlmClient & { calls: number };
}

function echoTool(name: string, data: unknown = { rows: 1 }): AiTool<any> {
  return {
    name, kind: "read", description: name,
    schema: z.object({}).passthrough(),
    async handler() { return { ok: true, data }; },
  };
}

const call = (name: string, args: unknown = {}) => ({ id: `c_${name}`, name, args });

const run = (llm: ToolCallingLlmClient, tools: AiTool<any>[], question = "how is traffic?") =>
  runAgent({
    llm, registry: new ToolRegistry(tools), ctx: CTX,
    system: "s", history: [], question,
  });

describe("runAgent", () => {
  it("answers without tools when the model does not ask for any", async () => {
    const out = await run(fakeLlm([{ text: "Traffic is up 12%." }]), []);
    expect(out.answer).toBe("Traffic is up 12%.");
    expect(out.toolCalls).toHaveLength(0);
  });

  it("runs a requested tool and answers from the result", async () => {
    const llm = fakeLlm([
      { toolCalls: [call("get_traffic_summary")] },
      { text: "You had 1 visitor." },
    ]);
    const out = await run(llm, [echoTool("get_traffic_summary")]);
    expect(out.toolCalls).toEqual([
      { name: "get_traffic_summary", args: {}, ok: true },
    ]);
    expect(out.answer).toBe("You had 1 visitor.");
  });

  it("accumulates tokens across every turn", async () => {
    // One question can be several paid calls, and reporting only the last would
    // under-report what the feature costs.
    const llm = fakeLlm([
      { toolCalls: [call("a")], inputTokens: 100, outputTokens: 20 },
      { text: "done", inputTokens: 50, outputTokens: 10 },
    ]);
    const out = await run(llm, [echoTool("a")]);
    expect(out.inputTokens).toBe(150);
    expect(out.outputTokens).toBe(30);
  });

  it("feeds a tool failure back rather than ending the turn", async () => {
    const failing: AiTool<any> = {
      name: "boom", kind: "read", description: "b", schema: z.object({}),
      async handler() { throw new Error("upstream down"); },
    };
    const llm = fakeLlm([
      { toolCalls: [call("boom")] },
      { text: "I couldn't read that just now." },
    ]);
    const out = await run(llm, [failing]);
    expect(out.toolCalls[0]?.ok).toBe(false);
    expect(out.answer).toContain("couldn't read");
  });

  it("stops at the turn ceiling instead of looping forever", async () => {
    // A model that keeps asking for tools is looping, and every turn is a paid call.
    const llm = fakeLlm([{ toolCalls: [call("a")] }]);
    const out = await run(llm, [echoTool("a")]);
    expect(out.truncated).toBe(true);
    expect(out.turns).toBeLessThanOrEqual(4);
    expect(out.answer).toContain("wasn't able to finish");
  });

  it("never returns an empty answer", async () => {
    // An empty string renders as the assistant having replied with nothing.
    const llm = fakeLlm([{ toolCalls: [call("a")] }]);
    const out = await run(llm, [echoTool("a")]);
    expect(out.answer.length).toBeGreaterThan(0);
  });

  it("caps the number of tool calls across the whole run", async () => {
    const llm = fakeLlm([
      { toolCalls: Array.from({ length: 20 }, (_, i) => call("a", { i })) },
      { text: "done" },
    ]);
    const out = await run(llm, [echoTool("a")]);
    expect(out.toolCalls.length).toBeLessThanOrEqual(8);
    expect(out.truncated).toBe(true);
  });

  describe("proposals", () => {
    const proposeTool: AiTool<any> = {
      name: "propose_automation", kind: "propose", description: "p",
      schema: z.object({}).passthrough(),
      async handler() {
        return {
          ok: true,
          data: {
            proposal: {
              resource: "automation", operation: "create", payload: { status: "draft" },
              summary: { title: "Exit offer", lines: [], hasExternalEffect: false },
            },
          },
        };
      },
    };

    it("captures the draft and stops", async () => {
      // Continuing would let the model act on a change nobody has accepted.
      const llm = fakeLlm([
        { toolCalls: [call("propose_automation")], text: "Here's a draft." },
        { text: "should never be reached" },
      ]);
      const out = await run(llm, [proposeTool], "create an exit popup");
      expect(out.proposal?.resource).toBe("automation");
      expect(out.answer).toContain("draft");
    });

    it("does not treat ordinary tool data as a proposal", async () => {
      const llm = fakeLlm([{ toolCalls: [call("a")] }, { text: "ok" }]);
      const out = await run(llm, [echoTool("a", { proposal: "not an object" })]);
      expect(out.proposal).toBeNull();
    });
  });

  describe("tool dispatch", () => {
    it("tells the model when it asked for a tool that does not exist", async () => {
      const llm = fakeLlm([{ toolCalls: [call("nope")] }, { text: "ok" }]);
      const out = await run(llm, [echoTool("a")]);
      expect(out.toolCalls[0]).toEqual({ name: "nope", args: {}, ok: false });
    });

    it("rejects arguments that do not match the schema", async () => {
      const strict: AiTool<any> = {
        name: "strict", kind: "read", description: "s",
        schema: z.object({ funnelId: z.string().min(1) }),
        async handler() { return { ok: true, data: {} }; },
      };
      const llm = fakeLlm([{ toolCalls: [call("strict", { funnelId: 42 })] }, { text: "ok" }]);
      const out = await run(llm, [strict]);
      expect(out.toolCalls[0]?.ok).toBe(false);
    });
  });
});

describe("isObviouslyOffTopic", () => {
  it("catches requests with nothing to do with the product", () => {
    expect(isObviouslyOffTopic("write me a poem about the sea")).toBe(true);
    expect(isObviouslyOffTopic("what's the weather in Dhaka")).toBe(true);
    expect(isObviouslyOffTopic("write me some python code")).toBe(true);
  });

  it("does not catch real analytics questions", () => {
    // A false positive refuses real work and reads as a broken product, which is worse
    // than the occasional polite decline the model handles.
    for (const q of [
      "why did conversions drop after the redesign?",
      "write up what happened to traffic last week",
      "which page has the worst bounce rate?",
      "how is the checkout funnel performing?",
      "what errors are my visitors hitting?",
      "create an exit-intent popup for the pricing page",
    ]) {
      expect(isObviouslyOffTopic(q)).toBe(false);
    }
  });
});
