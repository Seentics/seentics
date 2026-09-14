import OpenAI from "openai";
import type { LlmClient, LlmCompletion } from "../../interfaces/llm-client.interface";
import type { AiProviderConfig } from "./provider-config";

/**
 * `LlmClient` over any endpoint speaking the OpenAI chat-completions API.
 *
 * That is OpenAI itself plus Groq, Together, OpenRouter, DeepSeek, vLLM and Ollama —
 * they differ by base URL and model name, not by wire format, so one adapter covers all
 * of them and a deployment switches with two environment variables.
 *
 * The client is built on first use rather than at construction so composing the
 * application never depends on AI being configured.
 */
export class OpenAiCompatibleClient implements LlmClient {
  private client: OpenAI | null = null;

  constructor(private readonly cfg: AiProviderConfig) {}

  private sdk(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.cfg.apiKey || "not-required",
        baseURL: this.cfg.baseUrl,
        timeout: this.cfg.timeoutMs,
        // One retry, not the SDK's default of two: this sits inside a request a person is
        // waiting on, and a provider that failed twice is not going to answer in time.
        maxRetries: 1,
      });
    }
    return this.client;
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<LlmCompletion> {
    const completion = await this.sdk().chat.completions.create({
      model: this.cfg.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      // Low but not zero: the task is near-deterministic translation and the worked
      // examples in the domain prompts should dominate.
      temperature: 0.1,
      max_tokens: this.cfg.maxOutputTokens,
    });

    return {
      content: completion.choices[0]?.message?.content ?? "",
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    };
  }

  async classify(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await this.sdk().chat.completions.create({
      model: this.cfg.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 10,
      temperature: 0,
    });
    return response.choices[0]?.message?.content?.trim().toLowerCase() ?? "";
  }
}
