import { describe, it, expect, afterEach, mock } from "bun:test";
import { AnthropicLlmClient } from "../services/llm/anthropic-client";
import type { AiProviderConfig } from "../services/llm/provider-config";

const cfg = (model = "claude-haiku-5-5"): AiProviderConfig => ({
  provider: "anthropic", model, apiKey: "k", baseUrl: undefined,
  inputCostPerToken: 0, outputCostPerToken: 0, maxOutputTokens: 4000, timeoutMs: 5_000,
});

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** Answers each request with the next scripted response and records the bodies sent. */
function scriptFetch(responses: Array<{ status?: number; body: unknown; headers?: Record<string, string> }>) {
  const sent: any[] = [];
  let i = 0;
  globalThis.fetch = mock(async (_url: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    const r = responses[Math.min(i++, responses.length - 1)]!;
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: r.headers });
  }) as unknown as typeof fetch;
  return sent;
}

const ok = (content: unknown[], stop = "end_turn") => ({
  body: { content, stop_reason: stop, usage: { input_tokens: 10, output_tokens: 5 } },
});

describe("AnthropicLlmClient", () => {
  it("sends no sampling parameters and low effort to a current-generation model", async () => {
    const sent = scriptFetch([ok([{ type: "text", text: "analytics" }])]);
    await new AnthropicLlmClient(cfg()).classify("s", "u");
    expect(sent[0].temperature).toBeUndefined();
    expect(sent[0].output_config).toEqual({ effort: "low" });
    expect(sent[0].thinking).toEqual({ type: "disabled" });
  });

  it("keeps thinking on for tool-calling chat", async () => {
    const sent = scriptFetch([ok([{ type: "text", text: "hi" }])]);
    await new AnthropicLlmClient(cfg()).chat({ system: "s", messages: [{ role: "user", content: "q" }], tools: [] });
    expect(sent[0].thinking).toBeUndefined();
    expect(sent[0].output_config).toEqual({ effort: "low" });
  });

  it("leaves the request shape alone for an older model", async () => {
    const sent = scriptFetch([ok([{ type: "text", text: "x" }])]);
    await new AnthropicLlmClient(cfg("claude-haiku-4-5")).classify("s", "u");
    expect(sent[0].output_config).toBeUndefined();
    expect(sent[0].thinking).toBeUndefined();
  });

  it("returns the stop reason and the raw blocks, thinking included", async () => {
    const blocks = [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "tool_use", id: "t1", name: "a", input: { days: 7 } },
    ];
    scriptFetch([ok(blocks, "tool_use")]);
    const turn = await new AnthropicLlmClient(cfg()).chat({ system: "s", messages: [{ role: "user", content: "q" }], tools: [] });
    expect(turn.stopReason).toBe("tool_use");
    expect(turn.raw).toEqual(blocks);
    expect(turn.toolCalls).toEqual([{ id: "t1", name: "a", args: { days: 7 } }]);
  });

  it("replays raw assistant blocks and sends parallel tool results in one user message", async () => {
    const sent = scriptFetch([ok([{ type: "text", text: "done" }])]);
    const raw = [
      { type: "thinking", thinking: "", signature: "sig" },
      { type: "tool_use", id: "t1", name: "a", input: {} },
      { type: "tool_use", id: "t2", name: "b", input: {} },
    ];
    await new AnthropicLlmClient(cfg()).chat({
      system: "s", tools: [],
      messages: [
        { role: "user", content: "q" },
        { role: "assistant", content: "", toolCalls: [], raw },
        { role: "tool", toolCallId: "t1", name: "a", content: "{}" },
        { role: "tool", toolCallId: "t2", name: "b", content: "{\"error\":\"x\"}", isError: true },
      ],
    });
    const msgs = sent[0].messages;
    expect(msgs).toHaveLength(3);
    expect(msgs[1].content).toEqual(raw);
    expect(msgs[2].content).toEqual([
      { type: "tool_result", tool_use_id: "t1", content: "{}" },
      { type: "tool_result", tool_use_id: "t2", content: "{\"error\":\"x\"}", is_error: true },
    ]);
  });

  it("fails a truncated JSON completion instead of returning a fragment", async () => {
    scriptFetch([ok([{ type: "text", text: "{\"sql\": \"SELECT" }], "max_tokens")]);
    await expect(new AnthropicLlmClient(cfg()).complete("s", "u")).rejects.toThrow(/max_tokens/);
  });

  it("retries an overloaded response and then succeeds", async () => {
    const sent = scriptFetch([
      { status: 529, body: { error: { type: "overloaded_error" } }, headers: { "retry-after": "0" } },
      ok([{ type: "text", text: "analytics" }]),
    ]);
    expect(await new AnthropicLlmClient(cfg()).classify("s", "u")).toBe("analytics");
    expect(sent).toHaveLength(2);
  });

  it("does not retry a bad request", async () => {
    const sent = scriptFetch([{ status: 400, body: { error: { type: "invalid_request_error" } } }]);
    await expect(new AnthropicLlmClient(cfg()).classify("s", "u")).rejects.toThrow(/400/);
    expect(sent).toHaveLength(1);
  });
});
