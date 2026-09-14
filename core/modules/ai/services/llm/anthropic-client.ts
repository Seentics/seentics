import type { LlmClient, LlmCompletion } from "../../interfaces/llm-client.interface";
import type { AiProviderConfig } from "./provider-config";

const ANTHROPIC_VERSION = "2023-06-01";

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/**
 * `LlmClient` over Anthropic's Messages API.
 *
 * Its own adapter rather than a base-URL change because the wire format genuinely
 * differs: the system prompt is a top-level field rather than a message, `max_tokens` is
 * required, and the reply is a list of content blocks.
 *
 * Written against `fetch` rather than the SDK so adding a provider does not add a
 * dependency — the request is a single JSON POST, and the SDK's value here would be
 * types this file already declares.
 */
export class AnthropicLlmClient implements LlmClient {
  constructor(private readonly cfg: AiProviderConfig) {}

  private async send(system: string, user: string, maxTokens: number): Promise<LlmCompletion> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const res = await fetch(
        `${this.cfg.baseUrl ?? "https://api.anthropic.com"}/v1/messages`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.cfg.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: this.cfg.model,
            max_tokens: maxTokens,
            temperature: 0.1,
            system,
            messages: [{ role: "user", content: user }],
          }),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        // The body carries the provider's own reason; truncated because it is logged.
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        throw new Error(`Anthropic request failed (${res.status}): ${detail}`);
      }

      const body = (await res.json()) as AnthropicResponse;
      const text = (body.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");

      return {
        content: text,
        inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Anthropic has no `response_format: json_object`, so the instruction to answer with a
   * bare JSON object is appended to the system prompt. The caller parses defensively
   * either way — "asked for JSON" was never "received JSON" on any provider.
   */
  async complete(systemPrompt: string, userPrompt: string): Promise<LlmCompletion> {
    const out = await this.send(
      `${systemPrompt}\n\nRespond with a single JSON object and nothing else — no prose, no markdown fence.`,
      userPrompt,
      this.cfg.maxOutputTokens,
    );
    return { ...out, content: stripJsonFence(out.content) };
  }

  async classify(systemPrompt: string, userPrompt: string): Promise<string> {
    const out = await this.send(systemPrompt, userPrompt, 16);
    return out.content.trim().toLowerCase();
  }
}

/**
 * Remove a ```json fence if the model wrapped its object in one.
 *
 * Models asked for bare JSON still fence it sometimes, and the caller's `JSON.parse`
 * would fail on a reply that is otherwise exactly right.
 */
export function stripJsonFence(raw: string): string {
  const fenced = /^\s*```(?:json)?\s*\n([\s\S]*?)\n?\s*```\s*$/.exec(raw);
  return (fenced?.[1] ?? raw).trim();
}
