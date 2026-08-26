import type { AppConfig } from "../../../config";
import type {
  TrackerGoal,
  TrackerWebsites,
  WebsiteTrackerRow,
} from "../interfaces";
import {
  buildPublicTrackerConfig,
  configureTrackerWebsiteCache,
  listTrackerGoals,
  resolveWebsiteForTracker,
} from "../repositories/tracker-website.repository";

/**
 * `TrackerWebsites` over the tracker-shaped repository.
 *
 * The cache stays separate from `CachedWebsiteQuery` — different row shape, a shorter
 * TTL, and a request volume an order of magnitude higher. Both are now invalidated
 * from the same module, which is the part that was previously impossible: the tracker
 * cache lived in `platform/lib` and no `website.updated` subscriber could see it.
 */
export class TrackerWebsiteService implements TrackerWebsites {
  /** Size and TTL come from config; call before serving traffic. */
  configure(cfg: AppConfig): void {
    configureTrackerWebsiteCache(cfg);
  }

  async resolve(websiteRef: string): Promise<WebsiteTrackerRow | null> {
    return resolveWebsiteForTracker(websiteRef);
  }

  async listGoals(websiteId: string): Promise<TrackerGoal[]> {
    return listTrackerGoals(websiteId);
  }

  async buildConfig(
    website: WebsiteTrackerRow,
    goals: TrackerGoal[],
  ): Promise<Record<string, unknown>> {
    return buildPublicTrackerConfig(website, goals);
  }
}
