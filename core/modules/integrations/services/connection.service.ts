import { log } from "../../../platform/observability/logger";
import type {
  ConnectionView, IntegrationFailure, IntegrationMutations, IntegrationProvider, IntegrationQueries,
  IntegrationResult, LeadPayload, Outcome, ProviderContext, ProviderView, DeliveryView,
} from "../interfaces";
import { TransportError } from "../lib/http";
import { redact } from "../lib/mask";
import type { Vault, VaultResolution } from "../lib/vault";
import { getProvider, providers } from "../providers/registry";
import {
  deleteConnection, getConnectionView, getStoredConnection, listConnectionViews, recentDeliveries,
  updateConnection, upsertConnection,
} from "../repositories/integration.repository";

const aad = (websiteId: string, provider: string) => `${websiteId}:${provider}`;

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
 * Connect, change, test and remove integrations for the dashboard.
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

  async list(websiteId: string): Promise<ProviderView[]> {
    const connections = new Map((await listConnectionViews(websiteId)).map((c) => [c.provider, c]));
    return providers.map((p) => ({
      id: p.id, label: p.label, description: p.description, docs_url: p.docsUrl, fields: p.fields,
      connection: connections.get(p.id) ?? null,
    }));
  }

  deliveries(websiteId: string, limit: number): Promise<DeliveryView[]> {
    return recentDeliveries(websiteId, limit);
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  async connect(websiteId: string, providerId: string, input: { credentials: unknown; config: unknown }): Promise<IntegrationResult<ConnectionView>> {
    const provider = getProvider(providerId);
    if (!provider) return fail("not_found", "Unknown integration.");
    const vault = this.vault();
    if (!vault.ok) return vault;

    const checked = this.parse(provider, input.credentials, input.config);
    if (!checked.ok) return checked;

    const proven = await this.prove(provider, checked.value.credentials, checked.value.config);
    if (!proven.ok) return proven;

    await upsertConnection({
      websiteId, provider: provider.id,
      credentials: vault.value.encrypt(JSON.stringify(checked.value.credentials), aad(websiteId, provider.id)),
      hint: provider.hint(checked.value.credentials),
      config: checked.value.config as Record<string, unknown>,
    });
    return this.view(websiteId, provider.id);
  }

  async update(websiteId: string, providerId: string, input: { enabled?: boolean; config?: unknown; credentials?: unknown }): Promise<IntegrationResult<ConnectionView>> {
    const provider = getProvider(providerId);
    if (!provider) return fail("not_found", "Unknown integration.");
    const stored = await getStoredConnection(websiteId, provider.id);
    if (!stored) return fail("not_found", "This integration is not connected.");

    // New credentials replace the old as a whole and are re-proven; a config change alone is
    // checked against the existing credentials, so a wrong list id is caught here, not at the
    // next lead.
    if (input.credentials !== undefined || input.config !== undefined) {
      const vault = this.vault();
      if (!vault.ok) return vault;
      const credentials = input.credentials !== undefined ? input.credentials : this.open(vault.value, stored.credentials, websiteId, provider.id);
      if (credentials === null) return fail("unavailable", "The stored credentials could not be read. Reconnect this integration.");
      const checked = this.parse(provider, credentials, input.config !== undefined ? input.config : stored.config);
      if (!checked.ok) return checked;
      const proven = await this.prove(provider, checked.value.credentials, checked.value.config);
      if (!proven.ok) return proven;

      if (input.credentials !== undefined) {
        await upsertConnection({
          websiteId, provider: provider.id,
          credentials: vault.value.encrypt(JSON.stringify(checked.value.credentials), aad(websiteId, provider.id)),
          hint: provider.hint(checked.value.credentials),
          config: checked.value.config as Record<string, unknown>,
        });
        if (input.enabled === false) await updateConnection(websiteId, provider.id, { enabled: false });
        return this.view(websiteId, provider.id);
      }
      await updateConnection(websiteId, provider.id, { config: checked.value.config as Record<string, unknown>, enabled: input.enabled });
      return this.view(websiteId, provider.id);
    }

    await updateConnection(websiteId, provider.id, { enabled: input.enabled });
    return this.view(websiteId, provider.id);
  }

  disconnect(websiteId: string, providerId: string): Promise<boolean> {
    return deleteConnection(websiteId, providerId);
  }

  async sendTest(websiteId: string, providerId: string): Promise<IntegrationResult<Outcome>> {
    const provider = getProvider(providerId);
    if (!provider) return fail("not_found", "Unknown integration.");
    const stored = await getStoredConnection(websiteId, provider.id);
    if (!stored) return fail("not_found", "This integration is not connected.");
    const vault = this.vault();
    if (!vault.ok) return vault;
    const credentials = this.open(vault.value, stored.credentials, websiteId, provider.id);
    if (credentials === null) return fail("unavailable", "The stored credentials could not be read. Reconnect this integration.");
    const checked = this.parse(provider, credentials, stored.config);
    if (!checked.ok) return checked;

    try {
      return { ok: true, value: await provider.deliver(TEST_LEAD, checked.value.credentials, checked.value.config, this.ctx) };
    } catch (err) {
      return { ok: true, value: { kind: "failed", retryable: true, message: err instanceof TransportError ? err.message : "unexpected error" } };
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

  private open(vault: Vault, ciphertext: string, websiteId: string, provider: string): unknown | null {
    try {
      return JSON.parse(vault.decrypt(ciphertext, aad(websiteId, provider)));
    } catch {
      return null;
    }
  }

  private async view(websiteId: string, provider: string): Promise<IntegrationResult<ConnectionView>> {
    const v = await getConnectionView(websiteId, provider);
    return v ? { ok: true, value: v } : fail("not_found", "This integration is not connected.");
  }
}

/** A clearly fake lead for the "send test" button. Marked `test` so receivers can ignore it. */
const TEST_LEAD: LeadPayload = {
  contactId: "00000000-0000-0000-0000-000000000000", isNewContact: true,
  email: "seentics-test@example.com", name: "Seentics Test", firstName: "Seentics", lastName: "Test",
  phone: "", consent: true, fields: {}, popupId: null, variant: null,
  pageUrl: "https://example.com/", referrer: "", submittedAt: new Date().toISOString(), test: true,
};
