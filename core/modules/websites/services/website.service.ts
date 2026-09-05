import { randomHex } from "../lib/ids";
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
import { roleAtLeast } from "../interfaces";

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
    /**
     * Called with the website id after any change to it.
     *
     * `CachedWebsiteQuery` sits in front of this service, so a mutation here leaves a
     * stale entry there until its TTL expires. This used to travel the long way round —
     * the repository wrote a `website.updated` row to a transactional outbox, a publisher
     * polled that table once a second, handed the event to an in-memory bus, and a
     * subscriber in `init.ts` called `invalidate`. Four moving parts and a database table
     * to deliver one function call inside one process, and it was the only thing any of
     * that machinery actually did.
     */
    private readonly onChanged: (websiteId: string) => void,
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
  /**
   * Assert the caller holds at least `minimum`, and return their role.
   *
   * `minimum` is required for the same reason as in `services/access.ts`: this used to
   * accept any non-null role, so every operation below was open to every collaborator —
   * including `deleteForUser`, which removes the website *and* cascades its
   * `analytics_events`, `automations` and `funnels` in one transaction.
   */
  private async authorize(
    websiteId: string,
    userId: string,
    minimum: WebsiteRole,
  ): Promise<WebsiteRole> {
    const role = await this.repository.findRole(websiteId, userId);
    if (!role || !roleAtLeast(role, minimum)) throw new WebsiteAccessError();
    return role;
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
    await this.authorize(websiteId, userId, "viewer");

    const website = await this.repository.findById(websiteId);
    if (!website) return null;

    const summaries = await this.analyticsModule().getTrafficSummary([websiteId]);
    return { ...website, traffic: summaries.get(websiteId) ?? emptyTrafficSummary() };
  }

  // ─── WebsiteMutations ────────────────────────────────────────────────────

  /**
   * Create a website owned by `ownerId`.
   *
   * The repository writes the website and the owner membership row in one transaction.
   */
  async create(ownerId: string, input: CreateWebsiteInput): Promise<Website> {
    return this.repository.create(ownerId, input);
  }

  async update(websiteId: string, input: UpdateWebsiteInput): Promise<Website | null> {
    const updated = await this.repository.update(websiteId, input);
    if (updated) this.onChanged(websiteId);
    return updated;
  }

  /** Update after an access check. Used by the authenticated HTTP layer. */
  async updateForUser(
    websiteId: string,
    userId: string,
    input: UpdateWebsiteInput,
  ): Promise<Website | null> {
    // Settings include the tracked domain and retention — administrative, not a
    // collaborator's to change.
    await this.authorize(websiteId, userId, "admin");
    const updated = await this.repository.update(websiteId, input);
    if (updated) this.onChanged(websiteId);
    return updated;
  }

  async delete(websiteId: string): Promise<boolean> {
    const deleted = await this.repository.delete(websiteId);
    if (deleted) this.onChanged(websiteId);
    return deleted;
  }

  /** Delete after an access check. Used by the authenticated HTTP layer. */
  async deleteForUser(websiteId: string, userId: string): Promise<boolean> {
    // Owner only. This destroys the website and everything collected under it.
    await this.authorize(websiteId, userId, "owner");
    const deleted = await this.repository.delete(websiteId);
    if (deleted) this.onChanged(websiteId);
    return deleted;
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
    // Publishing the dashboard to an unauthenticated URL. See `services/share.ts`.
    await this.authorize(websiteId, userId, "admin");
    return this.applySharing(websiteId, enabled);
  }

  private async applySharing(
    websiteId: string,
    enabled: boolean,
  ): Promise<string | null> {
    if (!enabled) {
      const cleared = await this.repository.setPublicShareId(websiteId, null);
      this.onChanged(websiteId);
      return cleared;
    }

    // Reuse the existing id when sharing is already on, so re-enabling does not
    // invalidate a link someone has already handed out.
    const existing = await this.repository.findById(websiteId);
    if (existing?.publicShareId) return existing.publicShareId;

    const shareId = await this.repository.setPublicShareId(websiteId, randomHex(12));
    this.onChanged(websiteId);
    return shareId;
  }
}
