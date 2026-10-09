import type { AuthedRouter } from "../../../platform/http/router";
import type { RetentionSiteSource } from "../../../platform/retention";
import type { UsageCounter } from "../../../platform/usage";
import type { ModuleLifecycle } from "../../../app/module";
import type {
  TrackerWebsites,
  WebsiteInvitations,
  WebsiteMutations,
  WebsitePublicSharing,
  WebsiteQuery,
} from "./index";
import type { ClientDirectory, OwnedWebsites } from "./client.interface";

/**
 * Everything the websites module offers, in one interface.
 *
 * This is what a peer module receives — `initHeatmapsModule({ websites })`
 * takes this type, not `WebsiteService`. Every member is itself an interface, so
 * handing a peer the whole module still hands it no implementation: there is no way
 * to reach the Postgres repository, the cache, or the mutation methods from here.
 *
 * Two read views, and the difference is load-bearing — see the field docs.
 */
export interface WebsitesModule extends ModuleLifecycle {
  /**
   * The cached view. What a peer module's *services* should use.
   *
   * Every analytics, recordings, heatmap, automation and AI request resolves a
   * website reference before it can do anything else, so this sits on the hottest
   * read path in the process. Five-minute TTL, invalidated from the event bus.
   */
  query: WebsiteQuery;

  /**
   * The uncached view. What a peer module's *routes* should use for access checks.
   *
   * `getRole` passes straight through the cache today, so this is belt-and-braces
   * rather than strictly required — but it means a later decision to cache roles
   * cannot silently widen the window in which a revoked collaborator still has
   * access.
   */
  accessChecks: WebsiteQuery;

  /** Settings changes outside a user's request — an operator's, through /internal. */
  mutations: Pick<WebsiteMutations, "update">;

  /**
   * Share-link resolution, for the public dashboard.
   *
   * Separate because the caller is anonymous and holds only a share id; revoking a
   * link has to take effect immediately, so this is never cached.
   */
  sharing: WebsitePublicSharing;

  /**
   * Invitation acceptance, mounted on the `/user` branch rather than here: the
   * caller holds only a token and has no website reference to authorize against.
   */
  invitations: WebsiteInvitations;


  /**
   * The tracker's view: per-feature flags, anonymous caller, its own short cache.
   *
   * Consumed by ingest's `/collect` and `/init`, the heatmap engine, and the internal
   * collectors.
   */
  trackerWebsites: TrackerWebsites;

  /** Clients: an owner's own customers, each grouping and governing some of their sites. */
  clients: ClientDirectory;

  /** An owner's sites, owner-only, for callers acting for an account without a session. */
  ownedWebsites: OwnedWebsites;

  /** The agency dashboard's client screens, behind the session middleware. */
  agencyRoutes: AuthedRouter;

  /**
   * The same client routes, plus owner-only websites, with **no auth of their own**.
   *
   * For the management API, which mounts them behind account-key authentication. Both
   * read the caller from `userId`, which that middleware sets. Mounting either anywhere
   * without such a middleware in front would answer every request with 401, not serve it.
   */
  managementRoutes: { clients: AuthedRouter; websites: AuthedRouter };

  /** This module's contribution to the per-user usage report. */
  usage: UsageCounter;

  /** The site list the retention sweep iterates over. */
  retentionSites: RetentionSiteSource;

  routes: AuthedRouter;
}
