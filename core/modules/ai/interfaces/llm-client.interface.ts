/** What the model returned, plus what it cost. */
export type LlmCompletion = {
  /** Raw message content. The caller parses and validates it — never trusted as SQL. */
  content: string;
  inputTokens: number;
  outputTokens: number;
};

/**
 * The language model, as a port.
 *
 * Injected so the pipeline around it can be tested. That pipeline is where the
 * interesting behaviour lives — the daily cap, the response cache, SQL validation, and
 * what gets recorded when a generated statement is refused — and none of it could be
 * exercised while reaching OpenAI was the only way in.
 *
 * Both methods return plain data rather than a provider response, so a second provider
 * or a stub is a matter of implementing two functions.
 */
export interface LlmClient {
  /**
   * Ask for a JSON object completion.
   *
   * Implementations request a JSON response format; the caller still parses
   * defensively, because "asked for JSON" is not "received JSON".
   */
  complete(systemPrompt: string, userPrompt: string): Promise<LlmCompletion>;

  /**
   * Classify a question into one of the known domains.
   *
   * Returns the raw string; the caller decides whether it names a real domain and falls
   * back when it does not.
   */
  classify(systemPrompt: string, userPrompt: string): Promise<string>;
}

/** One tool the model asked to run, as the provider reported it. */
export type ToolCallRequest = {
  /** Provider-assigned id. Echoed back so the result is matched to the call. */
  id: string;
  name: string;
  /** Raw arguments. Unvalidated — the registry parses them. */
  args: unknown;
};

export type ChatMessage =
  | { role: "user" | "assistant"; content: string; toolCalls?: ToolCallRequest[] }
  /** A tool's output, fed back so the model can use it. */
  | { role: "tool"; toolCallId: string; name: string; content: string };

export type ChatTurn = {
  /** Prose for the user. Empty when the model only asked for tools. */
  text: string;
  toolCalls: ToolCallRequest[];
  inputTokens: number;
  outputTokens: number;
};

/**
 * A tool-calling turn.
 *
 * Optional on the port because not every provider or model supports it, and the module
 * must degrade to the single-shot SQL path rather than fail. `supportsTools` is what the
 * agent checks before choosing a strategy — a missing method is discoverable, a thrown
 * "not implemented" halfway through a conversation is not.
 */
export interface ToolCallingLlmClient extends LlmClient {
  supportsTools: true;
  chat(input: {
    system: string;
    messages: ChatMessage[];
    tools: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
  }): Promise<ChatTurn>;
}

export function supportsToolCalling(client: LlmClient): client is ToolCallingLlmClient {
  return (client as ToolCallingLlmClient).supportsTools === true;
}
