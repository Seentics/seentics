/**
 * Which model provider the AI module talks to, and how.
 *
 * Chosen at runtime from the environment so a deployment can switch provider — or point
 * at a self-hosted model — without a rebuild. The module was hard-wired to OpenAI with
 * the model name a literal in two files; a provider change meant editing code.
 *
 * Most of the ecosystem speaks the OpenAI chat-completions API: Groq, Together,
 * OpenRouter, DeepSeek, Mistral's compatible endpoint, vLLM and Ollama all accept the
 * same request shape at a different base URL. Those need no new client, only
 * `AI_BASE_URL`. Anthropic and Google are the ones with genuinely different wire
 * formats, and they get their own adapters.
 */

export type AiProvider = "openai" | "anthropic" | "google" | "openai-compatible";

export type AiProviderConfig = {
  provider: AiProvider;
  model: string;
  apiKey: string;
  /** Overrides the provider default. Required for `openai-compatible`. */
  baseUrl?: string;
  /** Cost accounting, per token. Zero when the provider is self-hosted or unmetered. */
  inputCostPerToken: number;
  outputCostPerToken: number;
  /** Upper bound on a single completion. Keeps a runaway generation from becoming a bill. */
  maxOutputTokens: number;
  /** Wall-clock ceiling for one request, so a hung provider cannot hold a connection open. */
  timeoutMs: number;
};

const DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: "gpt-6-luna",
  anthropic: "claude-haiku-5-5",
  google: "gemini-2.0-flash",
  "openai-compatible": "",
};

/**
 * Published per-token pricing, used only to record what a question cost.
 *
 * Deliberately a lookup with a zero default rather than a required setting: a wrong
 * number here makes a usage report inaccurate, while a required one would stop a
 * self-hosted deployment from booting over a figure that does not apply to it.
 */
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
  // gpt-6-luna: OpenAI's small tier (Sept 2026). The gpt-6 family reasons before answering and,
  // on Chat Completions, calls tools only with reasoning off — the client handles both.
  "gpt-6-luna":         { input: 0.0000001,   output: 0.0000005 },
  "gpt-6.1-sol":        { input: 0.000002,    output: 0.00001 },
  "gpt-4o-mini":        { input: 0.00000015,  output: 0.0000006 },
  "gpt-4o":             { input: 0.0000025,   output: 0.00001 },
  // Haiku 5.5 is $0.50 / $2.50 per MTok above 100K input tokens; questions stay far below that.
  "claude-haiku-5-5":   { input: 0.0000001,   output: 0.0000005 },
  "claude-sonnet-5-5":  { input: 0.000002,    output: 0.00001 },
  "claude-opus-5-5":    { input: 0.000004,    output: 0.00002 },
  "claude-sonnet-5":    { input: 0.000002,    output: 0.00001 },
  "claude-haiku-4-5":   { input: 0.000001,    output: 0.000005 },
  "gemini-2.0-flash":   { input: 0.0000001,   output: 0.0000004 },
};

/**
 * The model for background work — daily insights, heatmap and session write-ups, alert
 * explanations — when no feature-specific model is named: each provider's cheap, fast tier.
 * These run for every site every day, so they never default to the chat model's price.
 */
export const BACKGROUND_MODEL: Record<AiProvider, string> = {
  openai: "gpt-6-luna",
  anthropic: "claude-haiku-5-5",
  google: "gemini-2.0-flash",
  // A self-hosted endpoint serves whatever AI_MODEL names; there is no cheaper tier to pick.
  "openai-compatible": "",
};

/**
 * Which provider to use.
 *
 * `AI_PROVIDER` when set. Otherwise whichever provider's own key is present, so setting
 * `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` alone is enough. With both present and no
 * `AI_PROVIDER`, Anthropic wins; set `AI_PROVIDER` to choose. A bare `AI_API_KEY` stays
 * OpenAI, as it always was.
 */
export function resolveAiProvider(env: NodeJS.ProcessEnv = process.env): AiProvider {
  const explicit = (env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (explicit) return explicit as AiProvider;
  if ((env.ANTHROPIC_API_KEY ?? "").trim()) return "anthropic";
  if ((env.OPENAI_API_KEY ?? "").trim()) return "openai";
  if ((env.GOOGLE_API_KEY ?? "").trim()) return "google";
  return "openai";
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Read the provider configuration.
 *
 * Returns `null` rather than throwing when no key is set: AI is optional, and the rest
 * of the product must boot without it. The routes answer "not configured" instead.
 */
export function readAiProviderConfig(env: NodeJS.ProcessEnv = process.env): AiProviderConfig | null {
  const provider = resolveAiProvider(env);
  if (!(provider in DEFAULT_MODEL)) return null;

  // Provider-specific key names are accepted so an existing OPENAI_API_KEY keeps working.
  const apiKey = (
    env.AI_API_KEY ??
    (provider === "openai" ? env.OPENAI_API_KEY : undefined) ??
    (provider === "anthropic" ? env.ANTHROPIC_API_KEY : undefined) ??
    (provider === "google" ? env.GOOGLE_API_KEY : undefined) ??
    ""
  ).trim();

  const baseUrl = (env.AI_BASE_URL ?? "").trim() || undefined;

  // A self-hosted endpoint legitimately has no key; a hosted provider without one cannot work.
  if (!apiKey && !baseUrl) return null;
  if (provider === "openai-compatible" && !baseUrl) return null;

  const model = (env.AI_MODEL ?? "").trim() || DEFAULT_MODEL[provider];
  if (!model) return null;

  const pricing = DEFAULT_PRICING[model] ?? { input: 0, output: 0 };

  return {
    provider,
    model,
    apiKey,
    baseUrl,
    inputCostPerToken: num(env.AI_INPUT_COST_PER_TOKEN, pricing.input),
    outputCostPerToken: num(env.AI_OUTPUT_COST_PER_TOKEN, pricing.output),
    // Room for the model's thinking as well as its answer: on current Claude models both
    // count against this, and a cap that only fits the answer cuts replies off mid-sentence.
    maxOutputTokens: num(env.AI_MAX_OUTPUT_TOKENS, 4000),
    timeoutMs: num(env.AI_TIMEOUT_MS, 30_000),
  };
}
