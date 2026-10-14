import type {
  ChatMessage, ChatTurn, LlmCompletion, StopReason, ToolCallingLlmClient,
} from "../../interfaces/llm-client.interface";
import type { AiProviderConfig } from "./provider-config";

const ANTHROPIC_VERSION = "2023-06-01";

type AnthropicBlock = { type: string; text?: string; id?: string; name?: string; input?: unknown };

type AnthropicResponse = {
  content?: AnthropicBlock[];
  stop_reason?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
};

/** Statuses worth one more try: rate limit, overload, and transient server errors. */
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 529]);
const MAX_ATTEMPTS = 3;
/** A `retry-after` longer than this is not worth holding a user's request open for. */
const MAX_RETRY_DELAY_MS = 5_000;

/**
 * Current-generation models (Haiku/Sonnet/Opus 5.x, Fable 5.x) reject sampling parameters
 * and take `output_config.effort` instead; older ones reject `effort` on Haiku. Only the
 * current generation gets the newer request shape.
 */
function isCurrentGeneration(model: string): boolean {
  return /^claude-(haiku|sonnet|opus|fable)-5/.test(model);
}

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
export class AnthropicLlmClient implements ToolCallingLlmClient {
  readonly supportsTools = true as const;

  constructor(private readonly cfg: AiProviderConfig) {}

  /**
   * Effort and thinking for one request.
   *
   * SQL generation and classification are short, fully specified tasks: thinking off,
   * low effort. The tool-calling chat keeps adaptive thinking (the model's default) at
   * low effort, because with thinking off a model can write a tool call into its prose
   * instead of a `tool_use` block, and the call silently never runs.
   */
  private modelParams(thinking: boolean): Record<string, unknown> {
    if (!isCurrentGeneration(this.cfg.model)) return {};
    return {
      output_config: { effort: "low" },
      ...(thinking ? {} : { thinking: { type: "disabled" } }),
    };
  }

  /** POST /v1/messages with a per-attempt timeout and bounded retries. */
  private async post(body: Record<string, unknown>): Promise<AnthropicResponse> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.cfg.timeoutMs);
      try {
        const res = await fetch(`${this.cfg.baseUrl ?? "https://api.anthropic.com"}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.cfg.apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
          },
          body: JSON.stringify({ model: this.cfg.model, ...body }),
          signal: controller.signal,
        });

        if (res.ok) return (await res.json()) as AnthropicResponse;

        // The body carries the provider's own reason; truncated because it is logged.
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        lastError = new Error(`Anthropic request failed (${res.status}): ${detail}`);
        if (!RETRYABLE.has(res.status) || attempt === MAX_ATTEMPTS) throw lastError;
        await sleep(retryDelay(res.headers.get("retry-after"), attempt));
      } catch (err) {
        if (err === lastError) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
        // Our own timeout is not retried: another full timeout would hold the user's request
        // open for minutes. A network failure is, like a 5xx — the request never landed.
        if (lastError.name === "AbortError" || attempt === MAX_ATTEMPTS) throw lastError;
        await sleep(retryDelay(null, attempt));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new Error("Anthropic request failed");
  }

  private async send(system: string, user: string, maxTokens: number): Promise<LlmCompletion> {
    const body = await this.post({
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
      ...this.modelParams(false),
    });

    const stop = normaliseStop(body.stop_reason);
    if (stop === "refusal") throw new Error("Anthropic declined the request (stop_reason: refusal)");
    // A cut-off JSON object or SQL statement is worse than no answer: the caller would
    // parse a fragment. Fail loudly so it is recorded as an error, not a success.
    if (stop === "max_tokens") throw new Error(`Anthropic reply hit max_tokens (${maxTokens})`);

    return {
      content: textOf(body.content ?? []),
      ...usageOf(body),
    };
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
    const out = await this.send(systemPrompt, userPrompt, 32);
    return out.content.trim().toLowerCase();
  }

  async chat(input: {
    system: string;
    messages: ChatMessage[];
    tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
    toolChoice?: "auto" | "none";
  }): Promise<ChatTurn> {
    const body = await this.post({
      max_tokens: this.cfg.maxOutputTokens,
      system: input.system,
      messages: toAnthropicMessages(input.messages),
      ...(input.tools.length
        ? {
            tools: input.tools.map((t) => ({
              name: t.name,
              description: t.description,
              input_schema: t.parameters,
            })),
            ...(input.toolChoice === "none" ? { tool_choice: { type: "none" } } : {}),
          }
        : {}),
      ...this.modelParams(true),
    });

    const blocks = body.content ?? [];
    return {
      text: textOf(blocks),
      toolCalls: blocks
        .filter((b) => b.type === "tool_use")
        .map((b) => ({ id: b.id ?? "", name: b.name ?? "", args: b.input ?? {} })),
      stopReason: normaliseStop(body.stop_reason),
      // Kept whole — thinking blocks included — so the turn can be replayed unchanged.
      raw: blocks,
      ...usageOf(body),
    };
  }
}

function textOf(blocks: AnthropicBlock[]): string {
  return blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
}

/** Cached input is still input: counted so usage and cost do not under-report. */
function usageOf(body: AnthropicResponse): { inputTokens: number; outputTokens: number } {
  const u = body.usage ?? {};
  return {
    inputTokens: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0),
    outputTokens: u.output_tokens ?? 0,
  };
}

function normaliseStop(reason: string | null | undefined): StopReason {
  switch (reason) {
    case "end_turn":
    case "stop_sequence":
      return "end";
    case "tool_use":
      return "tool_use";
    case "max_tokens":
      return "max_tokens";
    case "refusal":
      return "refusal";
    default:
      return "other";
  }
}

function retryDelay(retryAfter: string | null, attempt: number): number {
  const seconds = Number(retryAfter);
  if (retryAfter && Number.isFinite(seconds)) return Math.min(seconds * 1000, MAX_RETRY_DELAY_MS);
  // 0.5s, 1s — with jitter so concurrent requests do not retry in lockstep.
  return Math.min(500 * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS) * (0.5 + Math.random() / 2);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Anthropic's shape for a tool result differs from OpenAI's in two ways that matter:
 * results are `user` messages carrying `tool_result` blocks, not a `tool` role, and a
 * tool *use* is a content block on the assistant message rather than a sibling field.
 *
 * Consecutive tool results are sent as one user message. Splitting them across messages
 * is accepted, but teaches the model to stop calling tools in parallel.
 */
function toAnthropicMessages(messages: ChatMessage[]): unknown[] {
  const out: Array<{ role: string; content: unknown }> = [];
  for (const m of messages) {
    if (m.role === "tool") {
      const block = {
        type: "tool_result",
        tool_use_id: m.toolCallId,
        content: m.content,
        ...(m.isError ? { is_error: true } : {}),
      };
      const prev = out[out.length - 1];
      if (prev?.role === "user" && Array.isArray(prev.content)
        && (prev.content as Array<{ type?: string }>).every((b) => b.type === "tool_result")) {
        (prev.content as unknown[]).push(block);
      } else {
        out.push({ role: "user", content: [block] });
      }
      continue;
    }
    if (m.role === "assistant" && Array.isArray(m.raw)) {
      // This client's own turn: replayed exactly as received.
      out.push({ role: "assistant", content: m.raw });
      continue;
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      out.push({
        role: "assistant",
        content: [
          ...(m.content ? [{ type: "text", text: m.content }] : []),
          ...m.toolCalls.map((c) => ({
            type: "tool_use", id: c.id, name: c.name, input: c.args ?? {},
          })),
        ],
      });
      continue;
    }
    out.push({ role: m.role, content: m.content });
  }
  return out;
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
