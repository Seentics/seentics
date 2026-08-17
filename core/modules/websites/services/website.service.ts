import { randomHex } from "../lib/ids";
import type { EventBus } from "../../../infrastructure/events";
import {
  emptyTrafficSummary,
  type CreateWebsiteInput,
  type TrafficSummary,
  type TrafficSummaryProvider,
  type UpdateWebsiteInput,
  type Website,
  type WebsiteMutations,
  type WebsitePublicSharing,
  type WebsiteQuery,
  type WebsiteRepository,
  type WebsiteRole,
} from "../interfaces";

/** A website plus its trailing-30-day traffic, as the dashboard renders it. */
export type WebsiteWithTraffic = Website & { traffic: TrafficSummary };

/**
 * Raised when a caller lacks access to a website.
 *
 * Carries `status` because the HTTP layer maps thrown errors to status codes and
 * a bare `Error` would become a 500. Deliberately says "forbidden" for both
 * missing and unauthorized websites so the API cannot be used to enumerate which
 * site ids exist.
 */
export class WebsiteAccessError extends Error {
  readonly status = 403;
  constructor() {
    super("forbidden");
    this.name = "WebsiteAccessError";
  }
}

/**
 * Business logic for websites.
 *
 * Dependencies arrive through the constructor as interfaces, so this class knows
 * nothing about Postgres, Hono, or how traffic figures are computed. That is what
 * makes it unit-testable with doubles and what would let the traffic provider
 * become a remote call without touching this file.
 */
export class WebsiteService implements WebsiteQuery, WebsiteMutations, WebsitePublicSharing {
  constructor(
    private readonly repository: WebsiteRepository,
    private readonly traffic: TrafficSummaryProvider,
    private readonly eventBus: EventBus,
  ) {}

  // ─── WebsitePublicSharing ────────────────────────────────────────────────

  async resolvePublicShareId(
    publicShareId: string,
  ): Promise<{ websiteId: string; siteId: string } | null> {
    return this.repository.findByPublicShareId(publicShareId);
  }

  // ─── WebsiteQuery ────────────────────────────────────────────────────────

  async getById(websiteRef: string): Promise<Website | null> {
    const resolved = await this.repository.resolveRef(websiteRef);
    if (!resolved) return null;
    return this.repository.findById(resolved.id);
  }

  async listOwnedBy(ownerId: string): Promise<Website[]> {
    return this.repository.listOwnedBy(ownerId);
  }

  async getRole(websiteRef: string, userId: string): Promise<WebsiteRole | null> {
    const resolved = await this.repository.resolveRef(websiteRef);
    if (!resolved) return null;
    return this.repository.findRole(resolved.id, userId);
  }

  // ─── Access ──────────────────────────────────────────────────────────────

  /**
   * Resolve a reference and assert the user may act on it, returning the
   * canonical ids.
   *
   * Every authenticated entry point funnels through here so the
   * resolve-then-check order is applied consistently — checking access against
   * an unresolved reference is how a `siteId`-shaped path parameter slips past an
   * owner comparison.
   */
  private async authorize(
    websiteRef: string,
    userId: string,
  ): Promise<{ id: string; siteId: string }> {
    const resolved = await this.repository.resolveRef(websiteRef);
    if (!resolved) throw new WebsiteAccessError();

    const role = await this.repository.findRole(resolved.id, userId);
    if (!role) throw new WebsiteAccessError();

    return resolved;
  }

  // ─── Reads with traffic ──────────────────────────────────────────────────

  /**
   * Every website the user owns, each with its traffic summary.
   *
   * Traffic is fetched for all sites in one call — the list is the dashboard's
   * landing page, and a per-site lookup here is an N+1 on the hottest path.
   */
  async listOwnedWithTraffic(ownerId: string): Promise<WebsiteWithTraffic[]> {
    const owned = await this.repository.listOwnedBy(ownerId);
    if (owned.length === 0) return [];

    const summaries = await this.traffic.summarizeSites(owned.map((w) => w.siteId));
    return owned.map((website) => ({
      ...website,
      traffic: summaries.get(website.siteId) ?? emptyTrafficSummary(),
    }));
  }

  /** One website with traffic, after an access check. */
  async getWithTraffic(websiteRef: string, userId: string): Promise<WebsiteWithTraffic | null> {
    const { id, siteId } = await this.authorize(websiteRef, userId);

    const website = await this.repository.findById(id);
    if (!website) return null;

    const summaries = await this.traffic.summarizeSites([siteId]);
    return { ...website, traffic: summaries.get(siteId) ?? emptyTrafficSummary() };
  }

  // ─── WebsiteMutations ────────────────────────────────────────────────────

  /**
   * Create a website owned by `ownerId`.
   *
   * The repository writes the website, the owner membership row, and the
   * `website.created` outbox entry in one transaction. The bus publish here is a
   * best-effort fast path for same-process consumers; the outbox publisher is
   * what actually guarantees the event is delivered, so a failure to publish now
   * is not a reason to fail the request.
   */
  async create(ownerId: string, input: CreateWebsiteInput): Promise<Website> {
    const website = await this.repository.create(ownerId, input);

    await this.eventBus.publish("website.created", {
      websiteId: website.id,
      siteId: website.siteId,
      ownerId,
      url: website.url,
      occurredAt: new Date(),
    });

    return website;
  }

  async update(websiteRef: string, input: UpdateWebsiteInput): Promise<Website | null> {
    const resolved = await this.repository.resolveRef(websiteRef);
    if (!resolved) return null;
    return this.repository.update(resolved.id, input);
  }

  /** Update after an access check. Used by the authenticated HTTP layer. */
  async updateForUser(
    websiteRef: string,
    userId: string,
    input: UpdateWebsiteInput,
  ): Promise<Website | null> {
    const { id } = await this.authorize(websiteRef, userId);
    return this.repository.update(id, input);
  }

  async delete(websiteRef: string): Promise<boolean> {
    const resolved = await this.repository.resolveRef(websiteRef);
    if (!resolved) return false;
    return this.repository.delete(resolved.id);
  }

  /** Delete after an access check. Used by the authenticated HTTP layer. */
  async deleteForUser(websiteRef: string, userId: string): Promise<boolean> {
    const { id } = await this.authorize(websiteRef, userId);
    return this.repository.delete(id);
  }

  async setPublicSharing(websiteRef: string, enabled: boolean): Promise<string | null> {
    const resolved = await this.repository.resolveRef(websiteRef);
    if (!resolved) return null;
    return this.applySharing(resolved.id, resolved.siteId, enabled);
  }

  /** Toggle public sharing after an access check. */
  async setPublicSharingForUser(
    websiteRef: string,
    userId: string,
    enabled: boolean,
  ): Promise<string | null> {
    const { id, siteId } = await this.authorize(websiteRef, userId);
    return this.applySharing(id, siteId, enabled);
  }

  private async applySharing(
    websiteId: string,
    siteId: string,
    enabled: boolean,
  ): Promise<string | null> {
    if (!enabled) {
      const cleared = await this.repository.setPublicShareId(websiteId, null);
      await this.eventBus.publish("website.share_toggled", {
        websiteId,
        siteId,
        enabled: false,
        occurredAt: new Date(),
      });
      return cleared;
    }

    // Reuse the existing id when sharing is already on, so re-enabling does not
    // invalidate a link someone has already handed out.
    const existing = await this.repository.findById(websiteId);
    if (existing?.publicShareId) return existing.publicShareId;

    const shareId = await this.repository.setPublicShareId(websiteId, randomHex(12));
    await this.eventBus.publish("website.share_toggled", {
      websiteId,
      siteId,
      enabled: true,
      occurredAt: new Date(),
    });
    return shareId;
  }
}
