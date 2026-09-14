import type { LlmClient } from "../../interfaces/llm-client.interface";
import { AnthropicLlmClient } from "./anthropic-client";
import { GoogleLlmClient } from "./google-client";
import { OpenAiCompatibleClient } from "./openai-compatible-client";
import { readAiProviderConfig, type AiProviderConfig } from "./provider-config";

export type { AiProviderConfig, AiProvider } from "./provider-config";
export { readAiProviderConfig } from "./provider-config";

/**
 * Build the client for the configured provider.
 *
 * `null` when AI is not configured, which the routes answer as "unavailable" rather than
 * failing to boot — the rest of the product does not need a model key.
 */
export function createLlmClient(cfg: AiProviderConfig | null = readAiProviderConfig()): LlmClient | null {
  if (!cfg) return null;
  switch (cfg.provider) {
    case "anthropic": return new AnthropicLlmClient(cfg);
    case "google":    return new GoogleLlmClient(cfg);
    // OpenAI itself and every compatible endpoint share one adapter.
    default:          return new OpenAiCompatibleClient(cfg);
  }
}
