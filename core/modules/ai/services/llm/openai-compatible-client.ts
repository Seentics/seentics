import OpenAI from "openai";
import type {
  ChatMessage, ChatTurn, LlmCompletion, StopReason, ToolCallingLlmClient,
} from "../../interfaces/llm-client.interface";
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
export class OpenAiCompatibleClient implements ToolCallingLlmClient {
  readonly supportsTools = true as const;

  private client: OpenAI | null = null;

  constructor(private readonly cfg: AiProviderConfig) {}

  /**
   * Output limit and sampling for one request.
   *
   * OpenAI itself takes `max_completion_tokens` — its newer models refuse `max_tokens` — while
   * the compatible endpoints (Ollama, vLLM, Groq…) still expect `max_tokens`.
   *
   * On OpenAI, everything from gpt-5 on (and the o-series) reasons before answering: it refuses
   * any `temperature` but the default and spends part of the limit thinking. Only the older
   * gpt-4/gpt-3.5 models are sent a temperature, so a new model name works without a code change.
   * Those reasoning models get an explicit `reasoning_effort` instead: `none` where they call tools
   * (Chat Completions refuses function tools at any other effort) and for one-word classification,
   * `low` for the short JSON write-ups — enough to follow the format, without paying for depth.
   */
  private params(
    maxTokens: number,
    temperature: number,
    effort: "none" | "low",
  ): Record<string, number | string> {
    const openai = this.cfg.provider === "openai";
    const sampled = !openai || /^gpt-(3\.5|4)/.test(this.cfg.model);
    const limit = sampled ? maxTokens : Math.max(maxTokens, 2000);
    return {
      ...(openai ? { max_completion_tokens: limit } : { max_tokens: limit }),
      ...(sampled ? { temperature } : { reasoning_effort: effort }),
    };
  }

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
        // JSON mode is refused unless the prompt itself asks for JSON; said once here rather than
        // relying on every caller's prompt to happen to use the word.
        { role: "system", content: `${systemPrompt}\n\nRespond with a single JSON object.` },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      // Low but not zero: the task is near-deterministic translation and the worked
      // examples in the domain prompts should dominate.
      ...this.params(this.cfg.maxOutputTokens, 0.1, "low"),
    } as never) as OpenAI.Chat.Completions.ChatCompletion;

    // A cut-off JSON object is worse than no answer: the caller would parse a fragment.
    if (completion.choices[0]?.finish_reason === "length") {
      throw new Error(`Model reply hit the output limit (${this.cfg.maxOutputTokens} tokens)`);
    }

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
      ...this.params(10, 0, "none"),
    } as never) as OpenAI.Chat.Completions.ChatCompletion;
    return response.choices[0]?.message?.content?.trim().toLowerCase() ?? "";
  }

  /**
   * One tool-calling turn.
   *
   * `tool_choice: "auto"` rather than forcing a call: most turns are a question the model
   * should answer from tool output it already has, and forcing one produces a redundant
   * call per turn.
   */
  async chat(input: {
    system: string;
    messages: ChatMessage[];
    tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
    toolChoice?: "auto" | "none";
  }): Promise<ChatTurn> {
    const completion = await this.sdk().chat.completions.create({
      model: this.cfg.model,
      messages: [
        { role: "system", content: input.system },
        ...input.messages.map(toOpenAiMessage),
      ] as never,
      tools: input.tools.length
        ? input.tools.map((t) => ({
            type: "function" as const,
            function: { name: t.name, description: t.description, parameters: t.parameters },
          }))
        : undefined,
      tool_choice: input.tools.length ? (input.toolChoice ?? "auto") : undefined,
      ...this.params(this.cfg.maxOutputTokens, 0.1, "none"),
    } as never) as OpenAI.Chat.Completions.ChatCompletion;

    const choice = completion.choices[0]?.message;
    return {
      text: choice?.content ?? "",
      toolCalls: (choice?.tool_calls ?? []).flatMap((c: any) =>
        c.type === "function"
          ? [{ id: c.id, name: c.function.name, args: safeJson(c.function.arguments) }]
          : []),
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
      stopReason: stopReasonOf(completion.choices[0]?.finish_reason),
    };
  }
}

/** OpenAI's `finish_reason`, in the agent loop's terms. */
function stopReasonOf(reason: string | null | undefined): StopReason {
  switch (reason) {
    case "stop":
      return "end";
    case "tool_calls":
    case "function_call":
      return "tool_use";
    case "length":
      return "max_tokens";
    case "content_filter":
      return "refusal";
    default:
      return "other";
  }
}

function toOpenAiMessage(m: ChatMessage): unknown {
  if (m.role === "tool") {
    return { role: "tool", tool_call_id: m.toolCallId, content: m.content };
  }
  if (m.role === "assistant" && m.toolCalls?.length) {
    return {
      role: "assistant",
      content: m.content || null,
      tool_calls: m.toolCalls.map((c) => ({
        id: c.id,
        type: "function",
        function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) },
      })),
    };
  }
  return { role: m.role, content: m.content };
}

/**
 * Arguments arrive as a JSON string the model wrote, so they can be malformed.
 *
 * An empty object rather than a throw: the registry validates against the tool's schema
 * next and will produce a message the model can act on, which is more useful than the
 * turn dying on a parse error.
 */
function safeJson(raw: string | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
