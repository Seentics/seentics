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
