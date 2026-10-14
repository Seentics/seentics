import { describe, it, expect, afterEach, mock } from "bun:test";
import { OpenAiCompatibleClient } from "../services/llm/openai-compatible-client";
import type { AiProviderConfig } from "../services/llm/provider-config";

const cfg = (over: Partial<AiProviderConfig> = {}): AiProviderConfig => ({
  provider: "openai", model: "gpt-4o-mini", apiKey: "k", baseUrl: "https://llm.test/v1",
  inputCostPerToken: 0, outputCostPerToken: 0, maxOutputTokens: 4000, timeoutMs: 5_000, ...over,
});

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

/** Answers every request with `reply` and records the bodies sent. */
function stubFetch(reply: unknown) {
  const sent: any[] = [];
  globalThis.fetch = mock(async (_url: unknown, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(reply), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return sent;
}

const completion = (message: unknown, finish = "stop") => ({
  id: "x", object: "chat.completion", created: 0, model: "m",
  choices: [{ index: 0, message, finish_reason: finish }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
});

describe("OpenAiCompatibleClient", () => {
  it("sends max_completion_tokens to OpenAI itself", async () => {
    const sent = stubFetch(completion({ role: "assistant", content: "{}" }));
    await new OpenAiCompatibleClient(cfg()).complete("s", "u");
    expect(sent[0].max_completion_tokens).toBe(4000);
    expect(sent[0].max_tokens).toBeUndefined();
    expect(sent[0].temperature).toBe(0.1);
  });

  it("keeps max_tokens for a compatible endpoint", async () => {
    const sent = stubFetch(completion({ role: "assistant", content: "{}" }));
    await new OpenAiCompatibleClient(cfg({ provider: "openai-compatible", model: "llama3" })).complete("s", "u");
    expect(sent[0].max_tokens).toBe(4000);
    expect(sent[0].max_completion_tokens).toBeUndefined();
  });

  it("sends a reasoning model an effort instead of a temperature", async () => {
    const sent = stubFetch(completion({ role: "assistant", content: "analytics" }));
    await new OpenAiCompatibleClient(cfg({ model: "gpt-6-luna" })).classify("s", "u");
    expect(sent[0].temperature).toBeUndefined();
    expect(sent[0].reasoning_effort).toBe("none");
    expect(sent[0].max_completion_tokens).toBeGreaterThanOrEqual(2000);
  });

  it("calls tools on a reasoning model with reasoning off, as Chat Completions requires", async () => {
    const sent = stubFetch(completion({ role: "assistant", content: "hi" }));
    await new OpenAiCompatibleClient(cfg({ model: "gpt-6.1-sol" })).chat({
      system: "s", messages: [{ role: "user", content: "q" }],
      tools: [{ name: "a", description: "a", parameters: { type: "object", properties: {} } }],
    });
    expect(sent[0].reasoning_effort).toBe("none");
  });

  it("asks for low effort on a JSON write-up", async () => {
    const sent = stubFetch(completion({ role: "assistant", content: "{}" }));
    await new OpenAiCompatibleClient(cfg({ model: "gpt-6-luna" })).complete("s", "u");
    expect(sent[0].reasoning_effort).toBe("low");
  });

  it("reports why the model stopped", async () => {
    stubFetch(completion({
      role: "assistant", content: null,
      tool_calls: [{ id: "t1", type: "function", function: { name: "a", arguments: "{\"days\":7}" } }],
    }, "tool_calls"));
    const turn = await new OpenAiCompatibleClient(cfg()).chat({ system: "s", messages: [{ role: "user", content: "q" }], tools: [] });
    expect(turn.stopReason).toBe("tool_use");
    expect(turn.toolCalls).toEqual([{ id: "t1", name: "a", args: { days: 7 } }]);
  });

  it("fails a JSON completion that was cut off", async () => {
    stubFetch(completion({ role: "assistant", content: "{\"sql\":\"SEL" }, "length"));
    await expect(new OpenAiCompatibleClient(cfg()).complete("s", "u")).rejects.toThrow(/output limit/);
  });
});
