import { randomUUID } from "node:crypto";
import { log } from "../../../platform/observability/logger";
import type {
  ConnectionView, DeliveryQuery, DeliveryView, IntegrationFailure, IntegrationMutations, IntegrationProvider,
  IntegrationQueries, IntegrationResult, LeadPayload, Outcome, ProviderContext, ProviderInfo,
} from "../interfaces";
import { TransportError } from "../lib/http";
import { redact } from "../lib/mask";
import type { Vault, VaultResolution } from "../lib/vault";
import { getProvider, providers } from "../providers/registry";
import {
  countConnectionsOf, deleteConnection, getConnectionView, getStoredConnection, insertConnection,
  listConnectionViews, updateConnection,
} from "../repositories/connection.repository";
import { recentDeliveries, requeueFailed } from "../repositories/delivery.repository";
import { credentialContext } from "./delivery-attempt.service";

/** More than this on one website is a sign something is looping, and every one is a call per lead. */
export const MAX_CONNECTIONS_PER_WEBSITE = 10;

const fail = (code: IntegrationFailure["code"], message: string): IntegrationFailure => ({ ok: false, code, message });

/** Flatten zod issues into one readable sentence. */
function describeIssues(err: { issues: { path: (string | number)[]; message: string }[] }): string {
  return err.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
}

/** What the provider said, for a person. A transport failure has no status to show. */
function describeOutcome(outcome: Outcome): string {
  if (outcome.kind === "failed") {
    return outcome.auth ? `The provider rejected these credentials (${outcome.message}).` : `The provider returned an error: ${outcome.message}`;
  }
  return "Unexpected response from the provider.";
}

/**
 * Connect, change, test and remove destinations for the dashboard.
 *
 * Credentials come in as plain objects, are validated by the provider's own schema, proven
 * with a real call to the provider, and only then sealed and stored. They go out nowhere:
 * every view returned from here is built from the `credentials_hint` column.
 */
export class ConnectionService implements IntegrationQueries, IntegrationMutations {
  constructor(
    private readonly vaultResolution: VaultResolution,
    private readonly ctx: ProviderContext,
  ) {}

  // ─── Queries ────────────────────────────────────────────────────────────────

  async list(websiteId: string): Promise<{ providers: ProviderInfo[]; connections: ConnectionView[] }> {
    return {
      providers: providers.map((p) => ({ id: p.id, label: p.label, description: p.description, docs_url: p.docsUrl, fields: p.fields })),
      connections: await listConnectionViews(websiteId),
    };
  }

  deliveries(websiteId: string, q: DeliveryQuery): Promise<DeliveryView[]> {
    return recentDeliveries(websiteId, q);
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  async connect(
    websiteId: string,
    input: { provider: string; name?: string; credentials: unknown; config: unknown },
  ): Promise<IntegrationResult<ConnectionView>> {
    const provider = getProvider(input.provider);
    if (!provider) return fail("not_found", "Unknown integration.");
    const vault = this.vault();
    if (!vault.ok) return vault;
    if ((await countConnectionsOf(websiteId)) >= MAX_CONNECTIONS_PER_WEBSITE) {
      return fail("connection_limit", `A website can have up to ${MAX_CONNECTIONS_PER_WEBSITE} destinations. Remove one first.`);
    }

    const checked = this.parse(provider, input.credentials, input.config);
    if (!checked.ok) return checked;
    const proven = await this.prove(provider, checked.value.credentials, checked.value.config);
    if (!proven.ok) return proven;

    const id = randomUUID();
    await insertConnection({
      id, websiteId, provider: provider.id, name: input.name?.trim() || provider.label,
      credentials: vault.value.encrypt(JSON.stringify(checked.value.credentials), credentialContext(websiteId, id)),
      hint: provider.hint(checked.value.credentials),
      config: checked.value.config as Record<string, unknown>,
    });
    return this.view(websiteId, id);
  }

  async update(
    websiteId: string,
    connectionId: string,
    input: { name?: string; enabled?: boolean; config?: unknown; credentials?: unknown },
  ): Promise<IntegrationResult<ConnectionView>> {
    const stored = await getStoredConnection(websiteId, connectionId);
    if (!stored) return fail("not_found", "This destination does not exist.");
    const provider = getProvider(stored.provider);
    if (!provider) return fail("not_found", "Unknown integration.");

    const patch: Parameters<typeof updateConnection>[2] = {};
    if (input.name !== undefined) patch.name = input.name.trim() || provider.label;
    if (input.enabled !== undefined) patch.enabled = input.enabled;

    // New credentials replace the old as a whole and are re-proven; a config change alone is
    // checked against the existing credentials, so a wrong list id is caught here, not at the
    // next lead.
    if (input.credentials !== undefined || input.config !== undefined) {
      const vault = this.vault();
      if (!vault.ok) return vault;
      const credentials = input.credentials !== undefined ? input.credentials : this.open(vault.value, stored);
      if (credentials === null) return fail("unavailable", "The stored credentials could not be read. Reconnect this destination.");
      const checked = this.parse(provider, credentials, input.config !== undefined ? input.config : stored.config);
      if (!checked.ok) return checked;
      const proven = await this.prove(provider, checked.value.credentials, checked.value.config);
      if (!proven.ok) return proven;

      patch.config = checked.value.config as Record<string, unknown>;
      if (input.credentials !== undefined) {
        patch.credentials = {
          sealed: vault.value.encrypt(JSON.stringify(checked.value.credentials), credentialContext(websiteId, connectionId)),
          hint: provider.hint(checked.value.credentials),
        };
      }
    }

    await updateConnection(websiteId, connectionId, patch);
    return this.view(websiteId, connectionId);
  }

  disconnect(websiteId: string, connectionId: string): Promise<boolean> {
    return deleteConnection(websiteId, connectionId);
  }

  async sendTest(websiteId: string, connectionId: string): Promise<IntegrationResult<Outcome>> {
    const stored = await getStoredConnection(websiteId, connectionId);
    if (!stored) return fail("not_found", "This destination does not exist.");
    const provider = getProvider(stored.provider);
    if (!provider) return fail("not_found", "Unknown integration.");
    const vault = this.vault();
    if (!vault.ok) return vault;
    const credentials = this.open(vault.value, stored);
    if (credentials === null) return fail("unavailable", "The stored credentials could not be read. Reconnect this destination.");
    const checked = this.parse(provider, credentials, stored.config);
    if (!checked.ok) return checked;

    try {
      return { ok: true, value: await provider.deliver(testLead(), checked.value.credentials, checked.value.config, this.ctx, { id: randomUUID() }) };
    } catch (err) {
      return { ok: true, value: { kind: "failed", retryable: true, message: err instanceof TransportError ? err.message : "unexpected error" } };
    }
  }

  async retryDelivery(websiteId: string, deliveryId: string): Promise<IntegrationResult<{ id: string }>> {
    switch (await requeueFailed(websiteId, deliveryId)) {
      case "requeued":
        return { ok: true, value: { id: deliveryId } };
      case "disabled":
        return fail("invalid", "Switch this destination back on first; it was turned off after repeated failures.");
      default:
        return fail("not_found", "This delivery can no longer be retried.");
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private vault(): { ok: true; value: Vault } | IntegrationFailure {
    if (this.vaultResolution.vault) {
      if (this.vaultResolution.ephemeralDevKey) log.warn({ msg: "integrations_dev_key", note: "using the built-in development key; set INTEGRATIONS_ENCRYPTION_KEY" });
      return { ok: true, value: this.vaultResolution.vault };
    }
    return fail("no_key", this.vaultResolution.reason);
  }

  private parse(provider: IntegrationProvider, credentials: unknown, config: unknown) {
    const c = provider.credentialSchema.safeParse(credentials);
    if (!c.success) return fail("invalid", describeIssues(c.error));
    const k = provider.configSchema.safeParse(config ?? {});
    if (!k.success) return fail("invalid", describeIssues(k.error));
    return { ok: true as const, value: { credentials: c.data, config: k.data } };
  }

  /** Make a real call, so a typo or a revoked key is reported while someone is looking. */
  private async prove(provider: IntegrationProvider, credentials: unknown, config: unknown): Promise<IntegrationResult<null>> {
    let outcome: Outcome;
    try {
      outcome = await provider.verify(credentials, config, this.ctx);
    } catch (err) {
      return fail("unavailable", err instanceof TransportError ? `Could not reach ${provider.label}: ${err.message}.` : `Could not verify ${provider.label}.`);
    }
    if (outcome.kind === "ok") return { ok: true, value: null };
    const secrets = Object.values(credentials as Record<string, unknown>).filter((v): v is string => typeof v === "string");
    const message = redact(describeOutcome(outcome), secrets);
    const rejected = outcome.kind === "failed" && (outcome.auth || (outcome.httpStatus !== undefined && outcome.httpStatus < 500));
    return fail(rejected ? "rejected" : "unavailable", message);
  }

  private open(vault: Vault, stored: { id: string; website_id: string; credentials: string }): unknown | null {
    try {
      return JSON.parse(vault.decrypt(stored.credentials, credentialContext(stored.website_id, stored.id)));
    } catch {
      return null;
    }
  }

  private async view(websiteId: string, id: string): Promise<IntegrationResult<ConnectionView>> {
    const v = await getConnectionView(websiteId, id);
    return v ? { ok: true, value: v } : fail("not_found", "This destination does not exist.");
  }
}

/** A clearly fake lead for the "send test" button. Marked `test` so receivers can ignore it. */
function testLead(): LeadPayload {
  return {
    submissionId: randomUUID(),
    email: "seentics-test@example.com", name: "Seentics Test", firstName: "Seentics", lastName: "Test",
    phone: "", consent: true, fields: {}, prize: null, popupId: null, variant: null,
    pageUrl: "https://example.com/", referrer: "", submittedAt: new Date().toISOString(), test: true,
  };
}
