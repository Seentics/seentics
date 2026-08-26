import { randomHex } from "../lib/ids";
import type { EventBus } from "../../../infrastructure/events";
import { emptyTrafficSummary } from "../../analytics/interfaces";
import type { AnalyticsModule } from "../../analytics/interfaces";
import type {
  CreateWebsiteInput,
  UpdateWebsiteInput,
  Website,
  WebsiteMutations,
  WebsitePublicSharing,
  WebsiteQuery,
  WebsiteRepository,
  WebsiteRole,
  WebsiteTrafficReads,
  WebsiteUserMutations,
  WebsiteWithTraffic,
} from "../interfaces";

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
 * makes it unit-testable with doubles and what would let analytics become a remote
 * call without touching this file.
 */
export class WebsiteService
  implements
    WebsiteQuery,
    WebsiteMutations,
    WebsitePublicSharing,
    WebsiteTrafficReads,
    WebsiteUserMutations
{
  /**
   * `analyticsModule` is a getter, not the module.
   *
   * The two modules genuinely need each other — the website list embeds pageview
   * counts, and every analytics query resolves a website — so one of them has to be
   * constructible before the other exists. Reading the handle lazily is what makes
   * that possible: it is only ever called while serving a request, long after both
   * modules are built. Nothing here touches it during construction, so composing the
   * graph stays order-independent.
   */
  constructor(
    private readonly repository: WebsiteRepository,
    private readonly analyticsModule: () => AnalyticsModule,
    private readonly eventBus: EventBus,
  ) {}

  // ─── WebsitePublicSharing ────────────────────────────────────────────────

  async resolvePublicShareId(publicShareId: string): Promise<{ websiteId: string } | null> {
    return this.repository.findByPublicShareId(publicShareId);
  }

  // ─── WebsiteQuery ────────────────────────────────────────────────────────

  async getById(websiteId: string): Promise<Website | null> {
    return this.repository.findById(websiteId);
  }

  async listOwnedBy(ownerId: string): Promise<Website[]> {
    return this.repository.listOwnedBy(ownerId);
  }

  async getRole(websiteId: string, userId: string): Promise<WebsiteRole | null> {
    return this.repository.findRole(websiteId, userId);
  }

  // ─── Access ──────────────────────────────────────────────────────────────

  /**
   * Assert the user may act on this website.
   *
   * Every authenticated entry point funnels through here, so the check is applied in
   * one place. It used to resolve a reference first and hand back a pair of ids; with a
   * single identifier there is nothing to resolve, and the hazard that ordering guarded
   * against — checking access against an unresolved reference — cannot occur.
   */
  private async authorize(websiteId: string, userId: string): Promise<void> {
    const role = await this.repository.findRole(websiteId, userId);
    if (!role) throw new WebsiteAccessError();
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

    const summaries = await this.analyticsModule().getTrafficSummary(owned.map((w) => w.id));
    return owned.map((website) => ({
      ...website,
      traffic: summaries.get(website.id) ?? emptyTrafficSummary(),
    }));
  }

  /** One website with traffic, after an access check. */
  async getWithTraffic(websiteId: string, userId: string): Promise<WebsiteWithTraffic | null> {
    await this.authorize(websiteId, userId);

    const website = await this.repository.findById(websiteId);
    if (!website) return null;

    const summaries = await this.analyticsModule().getTrafficSummary([websiteId]);
    return { ...website, traffic: summaries.get(websiteId) ?? emptyTrafficSummary() };
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
      ownerId,
      url: website.url,
      occurredAt: new Date(),
    });

    return website;
  }

  async update(websiteId: string, input: UpdateWebsiteInput): Promise<Website | null> {
    return this.repository.update(websiteId, input);
  }

  /** Update after an access check. Used by the authenticated HTTP layer. */
  async updateForUser(
    websiteId: string,
    userId: string,
    input: UpdateWebsiteInput,
  ): Promise<Website | null> {
    await this.authorize(websiteId, userId);
    return this.repository.update(websiteId, input);
  }

  async delete(websiteId: string): Promise<boolean> {
    return this.repository.delete(websiteId);
  }

  /** Delete after an access check. Used by the authenticated HTTP layer. */
  async deleteForUser(websiteId: string, userId: string): Promise<boolean> {
    await this.authorize(websiteId, userId);
    return this.repository.delete(websiteId);
  }

  async setPublicSharing(websiteId: string, enabled: boolean): Promise<string | null> {
    return this.applySharing(websiteId, enabled);
  }

  /** Toggle public sharing after an access check. */
  async setPublicSharingForUser(
    websiteId: string,
    userId: string,
    enabled: boolean,
  ): Promise<string | null> {
    await this.authorize(websiteId, userId);
    return this.applySharing(websiteId, enabled);
  }

  private async applySharing(
    websiteId: string,
    enabled: boolean,
  ): Promise<string | null> {
    if (!enabled) {
      const cleared = await this.repository.setPublicShareId(websiteId, null);
      await this.eventBus.publish("website.share_toggled", {
        websiteId,
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
      enabled: true,
      occurredAt: new Date(),
    });
    return shareId;
  }
}
