import type { EventBus } from "../../infrastructure/events";
import type { AnalyticsModule } from "../analytics/interfaces";
import type { AuthModule } from "../auth/interfaces";
import type { WebsitesModule } from "./interfaces";
import { WebsiteUsageCounter } from "./services/usage-count.service";
import { PostgresWebsiteRepository } from "./repositories/postgres-website.repository";
import { createWebsiteRoutes } from "./routes";
import { CachedWebsiteQuery } from "./services/cached-website-query";
import { TrackerWebsiteService } from "./services/tracker-website.service";
import { WebsiteRetentionSiteSource } from "./services/retention-sites.service";
import { WebsiteInvitationService } from "./services/invitations.service";
import { WebsiteService } from "./services/website.service";

/**
 * Build the websites module.
 *
 * `analyticsModule` is a getter rather than the module, and it is the only place in
 * the system that needs one. Websites and analytics genuinely depend on each other — the
 * website list embeds pageview counts, and every analytics query resolves a website —
 * so one of the two has to be built before the other exists. Passing
 * `() => analyticsModule` lets websites go first: nothing calls it during construction, only
 * while serving a request.
 *
 * The alternatives were worse. A separate `traffic` port meant a second exported
 * function whose only job was to be constructible early, which read as ceremony.
 * Building websites in two phases left it half-initialised for two lines with nothing
 * in the type system saying so.
 */
export function initWebsitesModule(deps: {
  analyticsModule(): AnalyticsModule;
  /** For member names and invitation email checks — `users` belongs to auth. */
  authModule: AuthModule;
  eventBus: EventBus;
}): WebsitesModule {
  const { eventBus } = deps;

  const service = new WebsiteService(
    new PostgresWebsiteRepository(),
    deps.analyticsModule,
    eventBus,
  );
  const cached = new CachedWebsiteQuery(service);
  const tracker = new TrackerWebsiteService();

  // Cache coherence lives here rather than in the composition root, so the rule "a
  // website changed anywhere invalidates the cached view" is stated in the module that
  // owns both sides of it. Going through the bus instead of calling `invalidate` from
  // the mutation path is what keeps `WebsiteService` unaware a cache exists at all.
  for (const event of ["website.updated", "website.deleted", "website.share_toggled"] as const) {
    eventBus.subscribe(event, ({ websiteId }) => {
      cached.invalidate(websiteId);
    });
  }

  return {
    query: cached,
    accessChecks: service,
    sharing: service,
    invitations: new WebsiteInvitationService(deps.authModule.users),
    trackerWebsites: tracker,

    // Its own routes take the uncached service: this is the module doing the mutating,
    // and it must read its own writes.
    usage: new WebsiteUsageCounter(),
    retentionSites: new WebsiteRetentionSiteSource(),
    routes: createWebsiteRoutes({ websites: service, users: deps.authModule.users }),

    // Tracker cache sizing comes from config, so it waits for `start` like any other
    // configured resource.
    start(cfg) {
      tracker.configure(cfg);
    },

    stop() {
      cached.clear();
    },
  };
}
