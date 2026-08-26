import type { EventBus } from "../../infrastructure/events";
import type { AnalyticsModule } from "../analytics/interfaces";
import type { WebsitesModule } from "../websites/interfaces";
import type { HeatmapsModule } from "./interfaces";
import { HeatmapUsageCounter } from "./services/usage-count.service";
import { createHeatmapRoutes } from "./routes";
import { HeatmapRawReadService } from "./services/raw-reads.service";
import { HeatmapAutoCapture } from "./services/auto-capture.service";
import { getHeatmapEngine, initHeatmapEngine } from "./services/heatmap-engine.service";
import { HeatmapService } from "./services/heatmap.service";
import { HeatmapRetentionPurge } from "./services/retention-purge.service";
import { initializeScreenshotCache } from "./services/screenshot-cache";
import { HeatmapScreenshotRefreshService } from "./services/screenshot-refresh.service";
import { HeatmapScreenshotService } from "./services/screenshot.service";
import { HeatmapSettingsService } from "./services/settings.service";

/**
 * Build the heatmaps module.
 *
 * The five-class order below is forced by the dependency arrows and is nobody else's
 * business: `autoCapture` needs a capture function, and both `HeatmapService` and the
 * refresh service need `autoCapture`, so the screenshot service is built first and its
 * bound `captureForResolved` passed through — which is why that method is bound in its
 * constructor. This used to sit in the composition root, which meant the top-level app
 * file knew the name of a method on a class two layers inside this module.
 */
export function initHeatmapsModule(deps: {
  websitesModule: WebsitesModule;
  /** For the screenshot-target fallback: recent pageview URLs live in analytics. */
  analyticsModule: AnalyticsModule;
  eventBus: EventBus;
}): HeatmapsModule {
  const { eventBus } = deps;

  const settings = new HeatmapSettingsService(deps.websitesModule.query);
  const screenshots = new HeatmapScreenshotService(settings, eventBus);
  const autoCapture = new HeatmapAutoCapture(
    screenshots.captureForResolved,
    deps.analyticsModule.pageviewUrls,
  );
  const heatmaps = new HeatmapService(settings, autoCapture, eventBus);

  return {
    screenshots,
    maintenance: new HeatmapScreenshotRefreshService(settings, autoCapture),
    ingest: () => getHeatmapEngine(),
    retention: new HeatmapRetentionPurge(),
    usage: new HeatmapUsageCounter(),
    rawReads: new HeatmapRawReadService(),
    routes: createHeatmapRoutes({
      heatmaps,
      screenshots,
      websites: deps.websitesModule.accessChecks,
    }),

    start(cfg) {
      if (cfg.screenshotCache.enabled) {
        initializeScreenshotCache(cfg.screenshotCache.ttlMs, cfg.screenshotCache.maxEntries);
      }
      // The engine takes the bus, so it has to be built from the composed graph — an
      // engine created lazily on first ingest publishes to nobody. Here rather than
      // above because constructing it arms flush timers.
      initHeatmapEngine(eventBus, deps.websitesModule.trackerWebsites);
    },

    async stop() {
      await getHeatmapEngine().shutdown();
    },
  };
}
