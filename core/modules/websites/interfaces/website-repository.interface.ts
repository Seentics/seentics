import type {
  CreateWebsiteInput,
  UpdateWebsiteInput,
  Website,
  WebsiteRole,
} from "./website.interface";

/**
 * Persistence for websites.
 *
 * The service depends on this rather than on Drizzle or Postgres, which is what
 * keeps business logic free of query building and lets tests substitute an
 * in-memory double. `PostgresWebsiteRepository` is the production implementation.
 *
 * Methods take a resolved UUID (`websiteId`), not the loose "UUID or siteId"
 * reference the HTTP layer accepts — resolution happens once in the service so
 * every repository method can assume a canonical id.
 */
export interface WebsiteRepository {
  findById(websiteId: string): Promise<Website | null>;

  findBySiteId(siteId: string): Promise<Website | null>;

  listOwnedBy(ownerId: string): Promise<Website[]>;

  /**
   * Resolve a UUID-or-siteId reference to both identifiers.
   * `null` when no website matches.
   */
  resolveRef(websiteRef: string): Promise<{ id: string; siteId: string } | null>;

  /** The user's role, or `null` when they have neither ownership nor membership. */
  findRole(websiteId: string, userId: string): Promise<WebsiteRole | null>;

  /**
   * Identifiers behind an active public share link, or `null` when the link is
   * unknown or revoked. Returns ids only — the caller is anonymous.
   */
  findByPublicShareId(
    publicShareId: string,
  ): Promise<{ websiteId: string; siteId: string } | null>;

  /**
   * Insert the website, its owner membership row, and a `website.created`
   * outbox entry in one transaction, so a created website always has an owner
   * and an event.
   */
  create(ownerId: string, input: CreateWebsiteInput): Promise<Website>;

  /**
   * Apply a partial update. `null` when the row no longer exists.
   * Fields absent from `input` are left untouched.
   */
  update(websiteId: string, input: UpdateWebsiteInput): Promise<Website | null>;

  /**
   * Delete the website and everything scoped to it. `false` when it was already
   * gone.
   *
   * This crosses module tables on purpose: analytics events, funnels,
   * automations and goals are all scoped to a website and have no meaning once
   * it is gone. Doing it in one transaction is what prevents orphaned rows —
   * the alternative is a distributed cleanup saga, which the spec explicitly
   * warns against for something this contained.
   */
  delete(websiteId: string): Promise<boolean>;

  /** Set or clear `publicShareId`; returns the id when enabled, `null` when off. */
  setPublicShareId(websiteId: string, shareId: string | null): Promise<string | null>;
}
