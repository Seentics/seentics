import type { Outcome } from "../interfaces";
import { TransportError } from "./http";

export type RetryPolicy = { maxAttempts: number; baseDelayMs: number };
export const DEFAULT_RETRY: RetryPolicy = { maxAttempts: 3, baseDelayMs: 1_000 };

const sleep = (ms: number) => (ms > 0 ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

/**
 * Run `attempt` until it succeeds, is skipped, fails for good, or the budget runs out.
 *
 * Retried: a transport error, and a failure the provider marked retryable (429, 5xx).
 * Not retried: a 4xx — a lead the provider rejected will be rejected again — and a refused
 * credential. Back-off is exponential from `baseDelayMs`. Returns the final outcome and how
 * many attempts it took.
 */
export async function withRetry(
  attempt: () => Promise<Outcome>,
  policy: RetryPolicy = DEFAULT_RETRY,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<{ outcome: Outcome; attempts: number }> {
  let outcome: Outcome = { kind: "failed", retryable: false, message: "not attempted" };
  for (let n = 1; n <= policy.maxAttempts; n++) {
    try {
      outcome = await attempt();
    } catch (err) {
      if (!(err instanceof TransportError)) throw err;
      outcome = { kind: "failed", retryable: true, message: err.message };
    }
    if (outcome.kind !== "failed" || !outcome.retryable || n === policy.maxAttempts) return { outcome, attempts: n };
    await wait(policy.baseDelayMs * 2 ** (n - 1));
  }
  return { outcome, attempts: policy.maxAttempts };
}
