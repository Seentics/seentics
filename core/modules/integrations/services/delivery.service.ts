import { log } from "../../../platform/observability/logger";
import type { IntegrationProvider, LeadPayload, Outcome, ProviderContext } from "../interfaces";
import { redact } from "../lib/mask";
import { DEFAULT_RETRY, withRetry, type RetryPolicy } from "../lib/retry";
import type { VaultResolution } from "../lib/vault";
import { getProvider } from "../providers/registry";
import { listEnabledConnections, recordDelivery, type StoredConnection } from "../repositories/integration.repository";

/** A connection is switched off after this many leads in a row failed (each already retried). */
export const DISABLE_AFTER_FAILURES = 5;
/** Deliveries running at once, across all websites. The rest wait their turn. */
export const MAX_CONCURRENT_DELIVERIES = 8;

/** The part of a captured lead this service needs. Mirrors the leads module's `CapturedLead`. */
export type CapturedLeadInput = {
  contactId: string;
  isNewContact: boolean;
  submission: {
    websiteId: string; email: string; name: string; phone: string; consent: boolean;
    fields: Record<string, string | number | boolean>;
    automationId: string | null; variant: string | null; pageUrl: string; referrer: string;
  };
};

/** First word is the first name, the rest the last: good enough for a single "name" box. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const [first = "", ...rest] = name.trim().split(/\s+/).filter(Boolean);
  return { firstName: first, lastName: rest.join(" ") };
}

export function toLeadPayload(lead: CapturedLeadInput): LeadPayload {
  const s = lead.submission;
  return {
    contactId: lead.contactId, isNewContact: lead.isNewContact, email: s.email, name: s.name,
    ...splitName(s.name), phone: s.phone, consent: s.consent, fields: s.fields,
    popupId: s.automationId, variant: s.variant, pageUrl: s.pageUrl, referrer: s.referrer,
    submittedAt: new Date().toISOString(),
  };
}

/** A small counting semaphore, so a burst of leads cannot open unbounded connections. */
class Gate {
  private active = 0;
  private readonly waiting: Array<() => void> = [];
  constructor(private readonly limit: number) {}
  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.active++;
    try { return await task(); }
    finally { this.active--; this.waiting.shift()?.(); }
  }
}

/**
 * Sends each captured lead to every enabled connection on its website.
 *
 * Isolated per connection: one provider being down, slow or misconfigured neither delays nor
 * fails the others, and nothing here can affect the visitor's form, which has long since been
 * answered. Every attempt ends in a row in the delivery log, so "did it arrive?" always has an answer.
 */
export class DeliveryService {
  private readonly gate = new Gate(MAX_CONCURRENT_DELIVERIES);
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly vault: VaultResolution,
    private readonly ctx: ProviderContext,
    private readonly retry: RetryPolicy = DEFAULT_RETRY,
    private readonly wait?: (ms: number) => Promise<void>,
  ) {}

  /** The `LeadCapture.onCaptured` listener. Never throws. */
  handle = (lead: CapturedLeadInput): Promise<void> => {
    const job = this.deliverAll(lead).catch((err) =>
      log.error({ msg: "integrations_delivery_error", websiteId: lead.submission.websiteId, err: err instanceof Error ? err.message : "unknown" }),
    );
    this.inFlight.add(job);
    void job.finally(() => this.inFlight.delete(job));
    return job;
  };

  /** Wait for deliveries already started — for shutdown. */
  async drain(): Promise<void> {
    await Promise.allSettled([...this.inFlight]);
  }

  private async deliverAll(lead: CapturedLeadInput): Promise<void> {
    const connections = await listEnabledConnections(lead.submission.websiteId);
    const payload = toLeadPayload(lead);
    await Promise.all(connections.map((c) => this.gate.run(() => this.deliverOne(c, payload))));
  }

  private async deliverOne(connection: StoredConnection, payload: LeadPayload): Promise<void> {
    const started = Date.now();
    const provider = getProvider(connection.provider);
    let outcome: Outcome;
    let attempts = 1;
    let secrets: string[] = [];

    try {
      if (!provider) throw new SkipDelivery("unknown provider");
      if (!this.vault.vault) throw new SkipDelivery(`credentials unavailable: ${this.vault.reason}`);
      const credentials = this.openCredentials(provider, connection);
      secrets = Object.values(credentials as Record<string, unknown>).filter((v): v is string => typeof v === "string");
      const config = provider.configSchema.parse(connection.config);
      ({ outcome, attempts } = await withRetry(() => provider.deliver(payload, credentials, config, this.ctx), this.retry, this.wait));
    } catch (err) {
      // Anything unexpected — a corrupt ciphertext, a config that no longer parses — is a
      // failed delivery with a message, not a crash and not silence.
      outcome = { kind: "failed", retryable: false, message: err instanceof SkipDelivery ? err.message : "could not prepare delivery" };
    }

    const summary = summarize(outcome, secrets);
    const { disabled } = await recordDelivery({
      connectionId: connection.id,
      websiteId: connection.website_id,
      contactId: payload.contactId,
      ...summary,
      attempts,
      durationMs: Date.now() - started,
      disableAfter: DISABLE_AFTER_FAILURES,
    });
    if (disabled) log.warn({ msg: "integration_disabled", websiteId: connection.website_id, provider: connection.provider });
  }

  private openCredentials(provider: IntegrationProvider, connection: StoredConnection): unknown {
    const vault = this.vault.vault!;
    const plain = vault.decrypt(connection.credentials, `${connection.website_id}:${connection.provider}`);
    return provider.credentialSchema.parse(JSON.parse(plain));
  }
}

class SkipDelivery extends Error {}

/** One outcome as the columns the delivery log stores. Secrets are scrubbed from any message. */
function summarize(outcome: Outcome, secrets: readonly string[]) {
  switch (outcome.kind) {
    case "ok":
      return { status: "success" as const, httpStatus: outcome.httpStatus ?? null, error: null, disableNow: false };
    case "skipped":
      return { status: "skipped" as const, httpStatus: null, error: outcome.reason, disableNow: false };
    case "failed":
      return {
        status: "failed" as const,
        httpStatus: outcome.httpStatus ?? null,
        error: redact(outcome.message, secrets).slice(0, 500),
        // A refused credential will not fix itself; waiting for four more failures only wastes calls.
        disableNow: outcome.auth === true,
      };
  }
}
