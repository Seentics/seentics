import type { LlmClient, LlmCompletion } from "../../interfaces/llm-client.interface";
import { stripJsonFence } from "./anthropic-client";
import type { AiProviderConfig } from "./provider-config";

type GoogleResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
};

/**
 * `LlmClient` over Google's Generative Language API.
 *
 * A third wire format: the system prompt is `systemInstruction`, messages are `contents`
 * with `parts`, and generation settings live under `generationConfig`. Same reasoning as
 * the Anthropic adapter — one JSON POST, no new dependency.
 */
export class GoogleLlmClient implements LlmClient {
  constructor(private readonly cfg: AiProviderConfig) {}

  private async send(
    system: string,
    user: string,
    maxTokens: number,
    json: boolean,
  ): Promise<LlmCompletion> {
    const base = this.cfg.baseUrl ?? "https://generativelanguage.googleapis.com";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
    try {
      const res = await fetch(
        `${base}/v1beta/models/${encodeURIComponent(this.cfg.model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            // Header rather than a query parameter: a key in a URL ends up in logs.
            "x-goog-api-key": this.cfg.apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: {
              temperature: json ? 0.1 : 0,
              maxOutputTokens: maxTokens,
              ...(json ? { responseMimeType: "application/json" } : {}),
            },
          }),
          signal: controller.signal,
        },
      );

      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        throw new Error(`Google request failed (${res.status}): ${detail}`);
      }

      const body = (await res.json()) as GoogleResponse;
      const text = (body.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? "")
        .join("");

      return {
        content: text,
        inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<LlmCompletion> {
    const out = await this.send(systemPrompt, userPrompt, this.cfg.maxOutputTokens, true);
    return { ...out, content: stripJsonFence(out.content) };
  }

  async classify(systemPrompt: string, userPrompt: string): Promise<string> {
    const out = await this.send(systemPrompt, userPrompt, 16, false);
    return out.content.trim().toLowerCase();
  }
}
