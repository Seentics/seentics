import { log } from "../../../platform/observability/logger";
import type { Outcome, ProviderContext } from "../interfaces";
import { DISABLE_AFTER_FAILURES, retryDelayMs } from "../lib/backoff";
import { withDefaults } from "../lib/conversion-match";
import { TransportError } from "../lib/http";
import { redact } from "../lib/mask";
import type { VaultResolution } from "../lib/vault";
import { getConversionProvider } from "../providers/conversions/registry";
import { completeConversion, type ClaimedConversion, type ConversionAttemptResult } from "../repositories/conversion.repository";

/** Sealed credentials are bound to their destination, so a copied row is useless elsewhere. */
export const conversionCredentialContext = (websiteId: string, destinationId: string) => `conversion:${websiteId}:${destinationId}`;

/**
 * One attempt at one claimed conversion — the same rules as a lead's delivery: never throws
 * for a bad row, retries what may pass on the back-off schedule, and switches a destination
 * off when its credential is refused.
 */
export class ConversionAttemptService {
  constructor(
    private readonly vault: VaultResolution,
    private readonly ctx: ProviderContext,
    private readonly now: () => number = Date.now,
  ) {}

  async run(c: ClaimedConversion): Promise<void> {
    const attempts = c.attempt_count + 1;
    const { outcome, secrets } = await this.attempt(c);
    const { disabled } = await completeConversion({
      id: c.id,
      destinationId: c.destination_id,
      attempts,
      result: this.decide(outcome, attempts, secrets),
      disableAfter: DISABLE_AFTER_FAILURES,
    });
    if (disabled) log.warn({ msg: "conversion_destination_disabled", websiteId: c.website_id, platform: c.platform });
  }

  private async attempt(c: ClaimedConversion): Promise<{ outcome: Outcome; secrets: string[] }> {
    let secrets: string[] = [];
    try {
      const provider = getConversionProvider(c.platform);
      if (!provider) return { outcome: { kind: "failed", retryable: false, message: "unknown platform" }, secrets };
      if (!c.payload) return { outcome: { kind: "failed", retryable: false, message: "the event's data is no longer stored" }, secrets };
      if (!this.vault.vault) return { outcome: { kind: "failed", retryable: true, message: `credentials unavailable: ${this.vault.reason}` }, secrets };
      const plain = this.vault.vault.decrypt(c.credentials, conversionCredentialContext(c.website_id, c.destination_id));
      const credentials = provider.credentialSchema.parse(JSON.parse(plain));
      secrets = Object.values(credentials as Record<string, unknown>).filter((v): v is string => typeof v === "string");
      return { outcome: await provider.send(c.payload, credentials, withDefaults(c.platform, c.config), this.ctx), secrets };
    } catch (err) {
      if (err instanceof TransportError) return { outcome: { kind: "failed", retryable: true, message: err.message }, secrets };
      return { outcome: { kind: "failed", retryable: false, message: "could not prepare the event" }, secrets };
    }
  }

  private decide(outcome: Outcome, attempts: number, secrets: readonly string[]): ConversionAttemptResult {
    switch (outcome.kind) {
      case "ok":
        return { kind: "success", httpStatus: outcome.httpStatus ?? null };
      case "skipped":
        return { kind: "skipped", error: outcome.reason };
      case "failed": {
        const error = redact(outcome.message, secrets).slice(0, 500);
        const httpStatus = outcome.httpStatus ?? null;
        const delay = outcome.retryable && !outcome.auth ? retryDelayMs(attempts) : null;
        return delay === null
          ? { kind: "failed", httpStatus, error, disableNow: outcome.auth === true }
          : { kind: "retry", httpStatus, error, nextAttemptAt: new Date(this.now() + delay) };
      }
    }
  }
}
