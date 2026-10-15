import type { FunnelTrackerConfig, TrackerFunnel } from "../interfaces";
import { listActiveFunnels } from "../repositories/funnel.repository";
import { trackerFunnel } from "../lib/tracker-funnel";

/** Read-only active funnel configuration exposed to tracker endpoints. */
export class TrackerFunnelConfigService implements FunnelTrackerConfig {
  async activeForTracker(websiteId: string): Promise<TrackerFunnel[]> {
    return (await listActiveFunnels(websiteId)).map(trackerFunnel);
  }
}
