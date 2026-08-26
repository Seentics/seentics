/**
 * The websites module's public surface.
 *
 * Split by capability rather than exposed as one `IWebsitesModule`, so a
 * consumer depends only on what it uses. Automations needs to look a website up;
 * it has no business being able to delete one, and its constructor should say so.
 */

/**
 * A website in domain form — camelCase, no persistence or transport concerns.
 *
 * Two identifiers, both load-bearing:
 * - `id` is the UUID primary key; `website_members`, `funnels`, `automations`
 *   and `goals` are keyed by it.
 * - `siteId` is the short public id embedded in the tracker snippet; analytics
 *   rows are keyed by it.
 *
 * Most API paths accept either and resolve to the pair. Keep both on the domain
 * model so callers never have to re-resolve.
 */
export type Website = {
  id: string;
  siteId: string;
  ownerId: string;
  name: string;
  /** Bare hostname, no scheme and no leading `www.` — see `normalizeHostname`. */
  url: string;
  trackingId: string;
  isActive: boolean;
  isVerified: boolean;
  automationEnabled: boolean;
  funnelEnabled: boolean;
  heatmapEnabled: boolean;
  heatmapIncludePatterns: string | null;
  heatmapExcludePatterns: string | null;
  heatmapLayoutEnabled: boolean;
  replayEnabled: boolean;
  replaySamplingRate: number;
  replayIncludePatterns: string | null;
  replayExcludePatterns: string | null;
  verificationToken: string;
  /** Non-null when a public dashboard link is active. */
  publicShareId: string | null;
  settings: WebsiteSettings;
  createdAt: Date;
  updatedAt: Date;
};

export type WebsiteSettings = {
  allowedOrigins: string[];
  trackingEnabled: boolean;
  dataRetentionDays: number;
  useIpAnonymization: boolean;
  respectDoNotTrack: boolean;
  allowRawDataExport: boolean;
};

/** A user's relationship to a website. `null` means no access. */
export type WebsiteRole = "owner" | "member";

export type CreateWebsiteInput = {
  name: string;
  /** Accepts a bare host or full URL; normalized to a hostname on write. */
  url: string;
};

/**
 * Fields a website update may change, all optional.
 *
 * `null` is meaningful for the pattern fields — it clears them — so those are
 * `string | null` while absence means "leave alone". Distinguishing the two is
 * why this is not simply `Partial<Website>`.
 */
export type UpdateWebsiteInput = {
  name?: string;
  url?: string;
  isActive?: boolean;
  automationEnabled?: boolean;
  funnelEnabled?: boolean;
  heatmapEnabled?: boolean;
  heatmapIncludePatterns?: string | null;
  heatmapExcludePatterns?: string | null;
  heatmapLayoutEnabled?: boolean;
  replayEnabled?: boolean;
  replaySamplingRate?: number;
  replayIncludePatterns?: string | null;
  replayExcludePatterns?: string | null;
};

/**
 * Read access to websites — the interface other modules should depend on.
 *
 * ```ts
 * class AutomationService {
 *   constructor(private websites: WebsiteQuery) {}
 * }
 * ```
 */
export interface WebsiteQuery {
  /** `null` when no website matches. Accepts a UUID or a `siteId`. */
  getById(websiteRef: string): Promise<Website | null>;

  /** Every website the user owns, oldest first. */
  listOwnedBy(ownerId: string): Promise<Website[]>;

  /**
   * The user's role on the website, or `null` for no access.
   *
   * Prefer this over comparing `ownerId` yourself — it also covers members,
   * which owner comparison silently excludes.
   */
  getRole(websiteRef: string, userId: string): Promise<WebsiteRole | null>;
}

/** Write access. Held by the websites module's own routes, not by peer modules. */
export interface WebsiteMutations {
  create(ownerId: string, input: CreateWebsiteInput): Promise<Website>;

  /** `null` when the website does not exist. */
  update(websiteRef: string, input: UpdateWebsiteInput): Promise<Website | null>;

  /** `false` when there was nothing to delete. */
  delete(websiteRef: string): Promise<boolean>;

  /** Enable or disable the public dashboard link; returns the share id or null. */
  setPublicSharing(websiteRef: string, enabled: boolean): Promise<string | null>;
}

/**
 * Resolution of public dashboard share links.
 *
 * Separate from `WebsiteQuery` because the caller is anonymous: the public
 * dashboard has a share id and nothing else, and must not be able to reach the
 * by-id or by-owner lookups that assume an authenticated user.
 */
export interface WebsitePublicSharing {
  /**
   * Identifiers behind an active share link, or `null` when the link is unknown
   * or has been revoked.
   *
   * Returns only the ids — a public caller has no business receiving the owner,
   * verification token, or settings that the full `Website` carries.
   */
  resolvePublicShareId(
    publicShareId: string,
  ): Promise<{ websiteId: string; siteId: string } | null>;
}

