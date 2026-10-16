import { randomUUID } from "node:crypto";
import type { ProviderContext } from "../interfaces";
import type { ConversionAdmin, ConversionDestinationView, ConversionPlatform, DestinationConfig } from "../interfaces/conversions";
import { withDefaults } from "../lib/conversion-match";
import { TransportError } from "../lib/http";
import type { VaultResolution } from "../lib/vault";
import { getConversionProvider } from "../providers/conversions/registry";
import {
  conversionSummary,
  countDestinations,
  deleteDestination,
  getDestination,
  insertDestination,
  listConversionEvents,
  listDestinations,
  retryConversion,
  updateDestination,
  type DestinationRow,
} from "../repositories/conversion.repository";
import { conversionCredentialContext } from "./conversion-attempt.service";

const NAMES: Record<ConversionPlatform, string> = { meta: "Meta", ga4: "Google Analytics 4" };

function view(row: DestinationRow & { sent_7d?: number; failed_7d?: number; last_sent_at?: string | null }): ConversionDestinationView {
  return {
    id: row.id,
    platform: row.platform,
    name: row.name,
    enabled: row.enabled,
    status: row.status,
    last_error: row.last_error,
    credentials_hint: row.credentials_hint,
    config: withDefaults(row.platform, row.config),
    created_at: row.created_at,
    updated_at: row.updated_at,
    stats: { sent_7d: row.sent_7d ?? 0, failed_7d: row.failed_7d ?? 0, last_sent_at: row.last_sent_at ?? null },
  };
}

/**
 * Connecting, editing, testing and reading destinations.
 *
 * Credentials are checked with the platform before they are stored, sealed with the
 * integrations vault (bound to the destination's id), and never returned — the dashboard sees
 * a hint. `onChange` tells the router to drop its cached destinations for the site.
 */
export class ConversionAdminService implements ConversionAdmin {
  constructor(
    private readonly vault: VaultResolution,
    private readonly ctx: ProviderContext,
    private readonly onChange: (websiteId: string) => void,
  ) {}

  private seal(websiteId: string, id: string, credentials: unknown): string {
    if (!this.vault.vault) throw new Error(`credentials cannot be stored: ${this.vault.reason}`);
    return this.vault.vault.encrypt(JSON.stringify(credentials), conversionCredentialContext(websiteId, id));
  }

  private async check(
    platform: ConversionPlatform,
    raw: Record<string, string>,
  ): Promise<{ error: "invalid_credentials"; message: string } | { credentials: unknown; hint: string; accountRef: string }> {
    const provider = getConversionProvider(platform)!;
    const parsed = provider.credentialSchema.safeParse(raw);
    if (!parsed.success) return { error: "invalid_credentials" as const, message: parsed.error.issues[0]?.message ?? "Check the values" };
    try {
      const verified = await provider.verify(parsed.data, this.ctx);
      if (!verified.ok) return { error: "invalid_credentials" as const, message: verified.message };
      return { credentials: parsed.data, hint: verified.hint, accountRef: provider.accountRef(parsed.data) };
    } catch (err) {
      const message = err instanceof TransportError ? `Could not reach ${NAMES[platform]}: ${err.message}` : "Could not check these credentials";
      return { error: "invalid_credentials" as const, message };
    }
  }

  async list(websiteId: string) {
    return (await listDestinations(websiteId)).map(view);
  }

  async create(websiteId: string, input: { platform: ConversionPlatform; name?: string; credentials: Record<string, string>; config?: Partial<DestinationConfig> }) {
    const checked = await this.check(input.platform, input.credentials);
    if ("error" in checked) return checked;
    const id = randomUUID();
    const inserted = await insertDestination({
      id,
      websiteId,
      platform: input.platform,
      name: (input.name?.trim() || NAMES[input.platform]).slice(0, 80),
      accountRef: checked.accountRef,
      credentials: this.seal(websiteId, id, checked.credentials),
      hint: checked.hint.slice(0, 120),
      config: withDefaults(input.platform, input.config),
    });
    if (!inserted) return { error: "exists" as const };
    this.onChange(websiteId);
    const row = (await listDestinations(websiteId)).find((d) => d.id === id)!;
    return { destination: view(row) };
  }

  async update(websiteId: string, id: string, patch: { name?: string; enabled?: boolean; credentials?: Record<string, string>; config?: Partial<DestinationConfig> }) {
    const existing = await getDestination(websiteId, id);
    if (!existing) return { error: "not_found" as const };
    let sealed: { credentials: string; hint: string; accountRef: string } | null = null;
    if (patch.credentials) {
      const checked = await this.check(existing.platform, patch.credentials);
      if ("error" in checked) return checked;
      sealed = { credentials: this.seal(websiteId, id, checked.credentials), hint: checked.hint.slice(0, 120), accountRef: checked.accountRef };
    }
    await updateDestination(websiteId, id, {
      name: patch.name?.trim().slice(0, 80) || undefined,
      enabled: patch.enabled,
      ...(sealed ?? {}),
      config: patch.config ? withDefaults(existing.platform, { ...existing.config, ...patch.config }) : undefined,
    });
    this.onChange(websiteId);
    const row = (await listDestinations(websiteId)).find((d) => d.id === id)!;
    return { destination: view(row) };
  }

  async remove(websiteId: string, id: string) {
    const gone = await deleteDestination(websiteId, id);
    if (gone) this.onChange(websiteId);
    return gone;
  }

  async test(websiteId: string, id: string, testEventCode: string | null) {
    const d = await getDestination(websiteId, id);
    if (!d) return null;
    const provider = getConversionProvider(d.platform)!;
    if (!this.vault.vault) return { ok: false, message: `Credentials are unavailable: ${this.vault.reason}` };
    try {
      const credentials = provider.credentialSchema.parse(JSON.parse(this.vault.vault.decrypt(d.credentials, conversionCredentialContext(websiteId, id))));
      return await provider.test(credentials, withDefaults(d.platform, d.config), testEventCode?.trim() || null, this.ctx);
    } catch (err) {
      return { ok: false, message: err instanceof TransportError ? `Could not reach ${NAMES[d.platform]}: ${err.message}` : "Could not send the test event" };
    }
  }

  async events(websiteId: string, q: { destination: string | null; status: string | null; kind: string | null; limit: number; offset: number }) {
    const { rows, total } = await listConversionEvents(websiteId, q);
    return { events: rows, total };
  }

  retry(websiteId: string, id: string) {
    return retryConversion(websiteId, id);
  }

  summary(websiteId: string, days: number) {
    return conversionSummary(websiteId, days);
  }

  countForWebsites(websiteIds: readonly string[]) {
    return countDestinations(websiteIds);
  }
}
