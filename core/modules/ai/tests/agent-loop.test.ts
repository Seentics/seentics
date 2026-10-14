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
        stopReason: t.stopReason, raw: t.raw,
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

describe("runAgent — stop reasons and replay", () => {
  const proposeTool = echoTool("propose_automation", {
    proposal: { resource: "automation", operation: "create", summary: "s", payload: {} },
  });

  it("answers a draft with this run's prose only, not earlier answers in the history", async () => {
    const seen: unknown[] = [];
    const llm = fakeLlm([{ text: "Here's a popup draft.", toolCalls: [call("propose_automation")] }]);
    const out = await runAgent({
      llm, registry: new ToolRegistry([proposeTool]), ctx: CTX, system: "s",
      history: [
        { role: "user", content: "<question>traffic?</question>" },
        { role: "assistant", content: "Traffic is up 12%." },
      ],
      question: "set up a popup",
    });
    seen.push(out.answer);
    expect(out.proposal).not.toBeNull();
    expect(out.answer).toStartWith("Here's a popup draft.");
    expect(out.answer).not.toContain("Traffic is up 12%");
    expect(out.answer).toContain("confirm");
  });

  it("explains a draft from its own summary when the model wrote nothing", async () => {
    const titled = echoTool("propose_automation", {
      proposal: { resource: "automation", operation: "set_status", payload: {},
        summary: { title: "Turn off Black Friday banner", lines: ["It stops showing to visitors."] } },
    });
    const out = await run(fakeLlm([{ text: "", toolCalls: [call("propose_automation")] }]), [titled]);
    expect(out.answer).toContain("Turn off Black Friday banner");
    expect(out.answer).toContain("It stops showing to visitors.");
    expect(out.answer).toMatch(/Nothing changes until you review and confirm/);
  });

  it("withholds tools on the last turn so the model answers from what it read", async () => {
    const choices: Array<string | undefined> = [];
    let i = 0;
    const llm = {
      supportsTools: true,
      async complete() { throw new Error("unused"); },
      async classify() { return ""; },
      async chat(input: { toolChoice?: string }) {
        choices.push(input.toolChoice);
        i++;
        return i < 4
          ? { text: "", toolCalls: [{ id: `c${i}`, name: "a", args: {} }], inputTokens: 1, outputTokens: 1, stopReason: "tool_use" as const }
          : { text: "Traffic is up 12%; check /pricing next.", toolCalls: [], inputTokens: 1, outputTokens: 1, stopReason: "end" as const };
      },
    } as unknown as ToolCallingLlmClient;
    const out = await run(llm, [echoTool("a")]);
    // No propose_* tool registered here, so the final turn offers no tools at all.
    expect(choices).toEqual([undefined, undefined, undefined, "none"]);
    expect(out.answer).toBe("Traffic is up 12%; check /pricing next.");
  });

  it("does not run a tool call from a reply cut off at max_tokens", async () => {
    let ran = 0;
    const counted: AiTool<any> = { ...echoTool("a"), async handler() { ran++; return { ok: true, data: {} }; } };
    const llm = fakeLlm([{ text: "Looking", toolCalls: [call("a")], stopReason: "max_tokens" }]);
    const out = await run(llm, [counted]);
    expect(ran).toBe(0);
    expect(out.truncated).toBe(true);
    expect(out.answer).toContain("cut short");
  });

  it("reports a refusal instead of an empty answer", async () => {
    const out = await run(fakeLlm([{ text: "", stopReason: "refusal" }]), []);
    expect(out.answer.length).toBeGreaterThan(0);
  });

  it("replays the provider's raw turn and answers every call in it, even over the limit", async () => {
    const asked: Array<{ messages: unknown[] }> = [];
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, name: "a", args: {} }));
    const raw = [{ type: "thinking", thinking: "", signature: "sig" }];
    let i = 0;
    const llm = {
      supportsTools: true,
      async complete() { throw new Error("unused"); },
      async classify() { return ""; },
      async chat(input: { messages: unknown[] }) {
        // The live array: the loop keeps appending to it after this call returns.
        asked.push({ messages: input.messages });
        return i++ === 0
          ? { text: "", toolCalls: many, raw, inputTokens: 1, outputTokens: 1, stopReason: "tool_use" as const }
          : { text: "done", toolCalls: [], inputTokens: 1, outputTokens: 1, stopReason: "end" as const };
      },
    } as unknown as ToolCallingLlmClient;

    const out = await run(llm, [echoTool("a")]);
    expect(out.toolCalls).toHaveLength(8);
    const second = asked[0]?.messages as Array<{ role: string; raw?: unknown; isError?: boolean }>;
    expect(second.find((m) => m.role === "assistant")?.raw).toEqual(raw);
    const results = second.filter((m) => m.role === "tool");
    expect(results).toHaveLength(10);
    expect(results.filter((m) => m.isError)).toHaveLength(2);
  });
});

describe("runAgent — final turn", () => {
  it("keeps draft tools on the last turn so a researched change can still be drafted", async () => {
    const offered: string[][] = [];
    let i = 0;
    const llm = {
      supportsTools: true,
      async complete() { throw new Error("unused"); },
      async classify() { return ""; },
      async chat(input: { tools: Array<{ name: string }> }) {
        offered.push(input.tools.map((t) => t.name));
        i++;
        return i < 4
          ? { text: "", toolCalls: [{ id: `c${i}`, name: "a", args: {} }], inputTokens: 1, outputTokens: 1, stopReason: "tool_use" as const }
          : { text: "Drafting it.", toolCalls: [{ id: "p", name: "propose_automation", args: {} }], inputTokens: 1, outputTokens: 1, stopReason: "tool_use" as const };
      },
    } as unknown as ToolCallingLlmClient;
    const propose = echoTool("propose_automation", { proposal: { resource: "automation", operation: "create", payload: {}, summary: { title: "x", lines: [] } } });
    const out = await run(llm, [echoTool("a"), propose]);
    expect(offered[3]).toEqual(["propose_automation"]);
    expect(out.proposal).not.toBeNull();
  });
});
