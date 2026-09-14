import { describe, it, expect } from "bun:test";
import { readAiProviderConfig } from "../services/llm/provider-config";
import { createLlmClient } from "../services/llm";
import { stripJsonFence } from "../services/llm/anthropic-client";

const env = (over: Record<string, string | undefined> = {}) =>
  ({ ...over } as NodeJS.ProcessEnv);

describe("readAiProviderConfig", () => {
  it("returns null when nothing is configured", () => {
    // AI is optional. Returning null is what lets the application boot without a key.
    expect(readAiProviderConfig(env())).toBeNull();
  });

  it("defaults to openai with its default model", () => {
    const cfg = readAiProviderConfig(env({ AI_API_KEY: "k" }));
    expect(cfg?.provider).toBe("openai");
    expect(cfg?.model).toBe("gpt-4o-mini");
  });

  it("still reads OPENAI_API_KEY, so existing deployments keep working", () => {
    expect(readAiProviderConfig(env({ OPENAI_API_KEY: "k" }))?.apiKey).toBe("k");
  });

  it("does not read OPENAI_API_KEY for a different provider", () => {
    // Sending an OpenAI key to Anthropic would be a credential leak to a third party.
    expect(readAiProviderConfig(env({ AI_PROVIDER: "anthropic", OPENAI_API_KEY: "k" }))).toBeNull();
  });

  it("reads the provider-specific key", () => {
    const cfg = readAiProviderConfig(env({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "a" }));
    expect(cfg?.provider).toBe("anthropic");
    expect(cfg?.apiKey).toBe("a");
  });

  it("allows a keyless endpoint when a base URL is given", () => {
    // A self-hosted Ollama or vLLM has no API key, and requiring one would exclude it.
    const cfg = readAiProviderConfig(env({
      AI_PROVIDER: "openai-compatible",
      AI_BASE_URL: "http://localhost:11434/v1",
      AI_MODEL: "llama3",
    }));
    expect(cfg?.model).toBe("llama3");
    expect(cfg?.baseUrl).toBe("http://localhost:11434/v1");
  });

  it("refuses openai-compatible without a base URL", () => {
    // There is no default endpoint to fall back to, so this would fail at call time.
    expect(readAiProviderConfig(env({
      AI_PROVIDER: "openai-compatible", AI_API_KEY: "k", AI_MODEL: "m",
    }))).toBeNull();
  });

  it("rejects an unknown provider rather than guessing", () => {
    expect(readAiProviderConfig(env({ AI_PROVIDER: "wat", AI_API_KEY: "k" }))).toBeNull();
  });

  it("prices a known model and zeroes an unknown one", () => {
    expect(readAiProviderConfig(env({ AI_API_KEY: "k" }))?.inputCostPerToken).toBeGreaterThan(0);
    // A self-hosted model has no published price; zero keeps the report honest rather
    // than billing it at whatever the last hosted provider charged.
    expect(readAiProviderConfig(env({ AI_API_KEY: "k", AI_MODEL: "my-local-model" }))
      ?.inputCostPerToken).toBe(0);
  });

  it("lets pricing be overridden explicitly", () => {
    const cfg = readAiProviderConfig(env({
      AI_API_KEY: "k", AI_MODEL: "my-local-model", AI_INPUT_COST_PER_TOKEN: "0.5",
    }));
    expect(cfg?.inputCostPerToken).toBe(0.5);
  });
});

describe("createLlmClient", () => {
  it("returns null when unconfigured", () => {
    expect(createLlmClient(null)).toBeNull();
  });

  it("builds a client for each supported provider", () => {
    for (const [p, key] of [["openai", "AI_API_KEY"], ["anthropic", "AI_API_KEY"],
                            ["google", "AI_API_KEY"]] as const) {
      const cfg = readAiProviderConfig(env({ AI_PROVIDER: p, [key]: "k" }));
      expect(createLlmClient(cfg)).not.toBeNull();
    }
  });
});

describe("stripJsonFence", () => {
  it("unwraps a fenced object", () => {
    // Providers without a JSON response mode fence their output even when told not to,
    // and the caller's JSON.parse would fail on a reply that is otherwise correct.
    expect(stripJsonFence('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("unwraps a fence with no language tag", () => {
    expect(stripJsonFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("leaves bare JSON alone", () => {
    expect(stripJsonFence('{"a":1}')).toBe('{"a":1}');
  });

  it("does not strip backticks that are part of the content", () => {
    expect(stripJsonFence('{"sql":"SELECT `x`"}')).toBe('{"sql":"SELECT `x`"}');
  });
});
