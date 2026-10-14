import { log } from "../../../platform/observability/logger";
import type { Outcome, ProviderContext } from "../interfaces";
import { DISABLE_AFTER_FAILURES, retryDelayMs } from "../lib/backoff";
import { TransportError } from "../lib/http";
import { redact } from "../lib/mask";
import type { VaultResolution } from "../lib/vault";
import { getProvider } from "../providers/registry";
import { completeAttempt, type AttemptResult, type ClaimedDelivery } from "../repositories/delivery.repository";

/** The sealed credentials are bound to the destination they belong to, so a copied row is useless elsewhere. */
export const credentialContext = (websiteId: string, connectionId: string) => `${websiteId}:${connectionId}`;

/** Thrown for a delivery that cannot be attempted at all; the message reaches the delivery log. */
class CannotAttempt extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message);
  }
}

/**
 * One attempt at one claimed delivery, and what to do next about it.
 *
 * Never throws for a bad delivery: a corrupt ciphertext, a config that no longer parses or a
 * provider that has gone away is a failed delivery with a message, not a crashed worker and
 * not silence. A transport error and a provider's retryable status (429, 5xx) are retried on
 * the back-off schedule; anything else is final, and a refused credential also switches the
 * destination off.
 */
export class DeliveryAttemptService {
  constructor(
    private readonly vault: VaultResolution,
    private readonly ctx: ProviderContext,
    private readonly now: () => number = Date.now,
  ) {}

  async run(delivery: ClaimedDelivery): Promise<void> {
    const started = this.now();
    const attempts = delivery.attempt_count + 1;
    const { outcome, secrets } = await this.attempt(delivery);

    const result = this.decide(outcome, attempts, secrets);
    const { disabled } = await completeAttempt({
      deliveryId: delivery.id,
      connectionId: delivery.connection_id,
      attempts,
      durationMs: this.now() - started,
      result,
      disableAfter: DISABLE_AFTER_FAILURES,
    });
    if (disabled) log.warn({ msg: "integration_disabled", websiteId: delivery.website_id, provider: delivery.provider });
  }

  private async attempt(d: ClaimedDelivery): Promise<{ outcome: Outcome; secrets: string[] }> {
    let secrets: string[] = [];
    try {
      const provider = getProvider(d.provider);
      if (!provider) throw new CannotAttempt("unknown provider", false);
      if (!d.payload) throw new CannotAttempt("the lead's data is no longer stored", false);
      // A missing key is an operator's mistake and fixable in minutes: worth retrying.
      if (!this.vault.vault) throw new CannotAttempt(`credentials unavailable: ${this.vault.reason}`, true);

      const plain = this.vault.vault.decrypt(d.credentials, credentialContext(d.website_id, d.connection_id));
      const credentials = provider.credentialSchema.parse(JSON.parse(plain));
      secrets = Object.values(credentials as Record<string, unknown>).filter((v): v is string => typeof v === "string");
      const config = provider.configSchema.parse(d.config);
      return { outcome: await provider.deliver(d.payload, credentials, config, this.ctx, { id: d.id }), secrets };
    } catch (err) {
      if (err instanceof CannotAttempt) return { outcome: { kind: "failed", retryable: err.retryable, message: err.message }, secrets };
      if (err instanceof TransportError) return { outcome: { kind: "failed", retryable: true, message: err.message }, secrets };
      return { outcome: { kind: "failed", retryable: false, message: "could not prepare delivery" }, secrets };
    }
  }

  private decide(outcome: Outcome, attempts: number, secrets: readonly string[]): AttemptResult {
    switch (outcome.kind) {
      case "ok":
        return { kind: "success", httpStatus: outcome.httpStatus ?? null, error: null };
      case "skipped":
        return { kind: "skipped", httpStatus: null, error: outcome.reason };
      case "failed": {
        const error = redact(outcome.message, secrets).slice(0, 500);
        const httpStatus = outcome.httpStatus ?? null;
        // A refused credential will not fix itself, so it is final however many attempts remain.
        const delay = outcome.retryable && !outcome.auth ? retryDelayMs(attempts) : null;
        return delay === null
          ? { kind: "failed", httpStatus, error, disableNow: outcome.auth === true }
          : { kind: "retry", httpStatus, error, nextAttemptAt: new Date(this.now() + delay) };
      }
    }
  }
}
