import type { EventBus } from "../../infrastructure/events";
import type { AnalyticsModule } from "../analytics/interfaces";
import type { WebsitesModule } from "../websites/interfaces";
import type { FunnelsModule } from "./interfaces";
import { FunnelUsageCounter } from "./services/usage-count.service";
import { createFunnelRoutes } from "./routes";
import { FunnelService } from "./services/funnel.service";

/** Build the funnels module. */
export function initFunnelsModule(deps: {
  websitesModule: WebsitesModule;
  /** Funnel step counts are an `analytics_events` aggregation. */
  analyticsModule: AnalyticsModule;
  eventBus: EventBus;
}): FunnelsModule {
  const funnels = new FunnelService(
    deps.websitesModule.query,
    deps.analyticsModule.funnelEvents,
    deps.eventBus,
  );

  return {
    trackerConfig: funnels,
    usage: new FunnelUsageCounter(),
    routes: createFunnelRoutes({ funnels, websites: deps.websitesModule.accessChecks }),
  };
}
