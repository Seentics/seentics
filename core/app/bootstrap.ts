import type { AppConfig } from "../config";
import { InMemoryEventBus, type EventBus } from "../infrastructure/events";
import { OutboxPublisher, postgresOutboxStore } from "../infrastructure/outbox";
import { log, type Logger } from "../platform/lib/logger";
import { AnalyticsTrafficSummaryService } from "../modules/analytics/services/traffic-summary.service";
import { AnalyticsQueryService } from "../modules/analytics/services/analytics-query.service";
import { PublicDashboardService } from "../modules/analytics/services/public-dashboard.service";
import { createAnalyticsRoutes } from "../modules/analytics/routes";
import { AnalyticsRetentionPurge } from "../modules/analytics/services/retention-purge.service";
import { createAiRoutes } from "../modules/ai/routes";
import { AiService } from "../modules/ai/services/ai.service";
import { createAutomationRoutes } from "../modules/automations/routes";
import { PostgresAutomationRepository } from "../modules/automations/repositories/postgres-automation.repository";
import { AutomationService } from "../modules/automations/services/automation.service";
import { AutomationRetentionPurge } from "../modules/automations/services/retention-purge.service";
import { createFunnelRoutes } from "../modules/funnels/routes";
import { FunnelService } from "../modules/funnels/services/funnel.service";
import { createHeatmapRoutes } from "../modules/heatmaps/routes";
import { HeatmapAutoCapture } from "../modules/heatmaps/services/auto-capture.service";
import { HeatmapService } from "../modules/heatmaps/services/heatmap.service";
import { HeatmapScreenshotRefreshService } from "../modules/heatmaps/services/screenshot-refresh.service";
import { HeatmapScreenshotService } from "../modules/heatmaps/services/screenshot.service";
import { HeatmapSettingsService } from "../modules/heatmaps/services/settings.service";
import { HeatmapRetentionPurge } from "../modules/heatmaps/services/retention-purge.service";
import { RecordingRetentionPurge } from "../modules/recordings/services/retention-purge.service";
import { createInternalRoutes } from "../platform/internal/routes";
import { initMaxMindGeo } from "../platform/lib/maxmind-geo";
import { configureTrackerOriginCache } from "../platform/lib/origin";
import { configureTrackerWebsiteCache } from "../platform/lib/website-for-tracker";
import { startScheduler, stopScheduler } from "../platform/scheduler";
import { getHeatmapEngine, initHeatmapEngine } from "../modules/heatmaps/services/heatmap-engine.service";
import { initializeScreenshotCache } from "../modules/heatmaps/services/screenshot-cache";
import { RetentionService } from "../platform/retention";
import { createTrackerRoutes } from "../modules/ingest/routes";
import {
  buildPublicTrackerConfig,

  listTrackerGoals,
  resolveWebsiteForTracker,
} from "../platform/lib/website-for-tracker";
import { IngestQueueService } from "../modules/ingest/services/ingest-queue.service";
import { ModuleIngestSinks } from "../modules/ingest/services/module-sinks";
import { AutomationEvaluationService } from "../modules/automations/services/evaluate.service";
import { getReplayEngine } from "../modules/recordings/services/recording-engine.service";
import { createRecordingRoutes } from "../modules/recordings/routes";
import { RecordingService } from "../modules/recordings/services/recording.service";
import { createWebsiteRoutes } from "../modules/websites/routes";
import { PostgresWebsiteRepository } from "../modules/websites/repositories/postgres-website.repository";
import { CachedWebsiteQuery } from "../modules/websites/services/cached-website-query";
import { WebsiteService } from "../modules/websites/services/website.service";

/**
 * Everything the HTTP layer and the background workers need, wired once.
 *
 * Returned rather than stashed in a global so there is exactly one place that
 * knows how the object graph fits together. Modules receive their dependencies
 * through constructors; nothing reaches back into a registry to find a
 * collaborator, which is what keeps each class's real coupling visible in its
 * signature.
 */
export type Application = {
  eventBus: EventBus;
  outboxPublisher: OutboxPublisher;
  websites: WebsiteService;
  websiteQuery: CachedWebsiteQuery;
  analytics: AnalyticsQueryService;
  recordings: RecordingService;
  funnels: FunnelService;
  heatmaps: HeatmapService;
  automations: AutomationService;
  ai: AiService;
  /** Daily data-retention sweep; also handed to the scheduler. */
  retention: RetentionService;
  /** Handed to the scheduler so it can re-capture stale heatmap screenshots. */
  heatmapScreenshots: HeatmapScreenshotRefreshService;
  /** Buffering and flush lifecycle for `/collect`. */
  ingest: IngestQueueService;
  routes: {
    analytics: ReturnType<typeof createAnalyticsRoutes>;
    recordings: ReturnType<typeof createRecordingRoutes>;
    funnels: ReturnType<typeof createFunnelRoutes>;
    tracker: ReturnType<typeof createTrackerRoutes>;
    websites: ReturnType<typeof createWebsiteRoutes>;
    heatmaps: ReturnType<typeof createHeatmapRoutes>;
    automations: ReturnType<typeof createAutomationRoutes>;
    ai: ReturnType<typeof createAiRoutes>;
    internal: ReturnType<typeof createInternalRoutes>;
  };
  /**
   * Initialise module state and begin background work.
   *
   * Call after the HTTP server is listening and migrations have run. Async because
   * the geo database is read from disk.
   */
  start(): Promise<void>;
  /** Stop background work, drain buffers, and shut the engines down in order. */
  stop(): Promise<void>;
};

/**
 * Compose the application graph.
 *
 * Order matters and is dictated by the dependency arrows, not by preference:
 * infrastructure, then repositories, then the services that need them, then the
 * routes that need those. A cycle here would be a compile error, which is the
 * point of wiring explicitly rather than resolving lazily.
 */
export function bootstrap(cfg: AppConfig, logger: Logger = log): Application {
  // ─── Infrastructure ──────────────────────────────────────────────────────
  const eventBus = new InMemoryEventBus(logger);
  const outboxPublisher = new OutboxPublisher(eventBus, postgresOutboxStore, logger);

  // ─── Websites ────────────────────────────────────────────────────────────
  const websiteRepository = new PostgresWebsiteRepository();

  // Analytics owns `analytics_events`, so the traffic figures the website list
  // embeds come from analytics through a port — the websites module never reads
  // that table. Constructed before WebsiteService because it is one of its
  // dependencies.
  const trafficSummary = new AnalyticsTrafficSummaryService();

  const websites = new WebsiteService(websiteRepository, trafficSummary, eventBus);

  // Analytics resolves a website reference on every request, so it gets the
  // cached view. The websites module itself keeps the uncached service, since it
  // is the thing doing the mutating and must read its own writes.
  const websiteQuery = new CachedWebsiteQuery(websites);

  // Cache coherence: a website changed anywhere in the process invalidates the
  // cached view. Wiring this through the bus rather than calling `invalidate`
  // from the mutation path is what keeps WebsiteService unaware that a cache
  // exists at all.
  eventBus.subscribe("website.updated", ({ websiteId, siteId }) => {
    websiteQuery.invalidate(websiteId, siteId);
  });
  eventBus.subscribe("website.deleted", ({ websiteId, siteId }) => {
    websiteQuery.invalidate(websiteId, siteId);
  });
  eventBus.subscribe("website.share_toggled", ({ websiteId, siteId }) => {
    websiteQuery.invalidate(websiteId, siteId);
  });

  // ─── Analytics ───────────────────────────────────────────────────────────
  const analytics = new AnalyticsQueryService(websiteQuery);
  const publicDashboard = new PublicDashboardService(websites);

  // ─── Recordings ──────────────────────────────────────────────────────────
  // Takes the cached website view for the same reason analytics does: it resolves
  // a reference on every list and detail request.
  const recordings = new RecordingService(websiteQuery, eventBus);

  // ─── Funnels ─────────────────────────────────────────────────────────────
  const funnels = new FunnelService(websiteQuery, eventBus);

  // ─── Heatmaps ────────────────────────────────────────────────────────────
  // Construction order is forced by the dependency arrows. `autoCapture` needs a
  // capture function and `HeatmapService` needs `autoCapture`, so the screenshot
  // service is built first and its bound `captureForResolved` passed through —
  // which is also why that method is bound in its constructor.
  const heatmapSettings = new HeatmapSettingsService(websiteQuery);
  const heatmapScreenshotService = new HeatmapScreenshotService(heatmapSettings, eventBus);
  const heatmapAutoCapture = new HeatmapAutoCapture(
    heatmapScreenshotService.captureForResolved,
  );
  const heatmaps = new HeatmapService(heatmapSettings, heatmapAutoCapture, eventBus);
  const heatmapScreenshots = new HeatmapScreenshotRefreshService(
    heatmapSettings,
    heatmapAutoCapture,
  );

  // ─── Automations ─────────────────────────────────────────────────────────
  const automations = new AutomationService(new PostgresAutomationRepository(), websiteQuery);

  // ─── Ingest ──────────────────────────────────────────────────────────────
  // The engines are supplied as sinks rather than fetched inside the flush, which is
  // what stops ingest reaching into another module's lifecycle. Passed as thunks
  // because constructing either engine starts timers and opens storage clients:
  // composing the graph must not begin background work.
  const ingestSinks = new ModuleIngestSinks(
    () => getReplayEngine(),
    () => getHeatmapEngine(),
  );
  const ingest = new IngestQueueService(ingestSinks, eventBus, logger);
  ingest.configure(cfg);

  // Constructed here so it publishes onto the real bus. The deprecated free
  // `evaluate()` builds its own `InMemoryEventBus`, whose events reach nobody.
  const automationEvaluation = new AutomationEvaluationService(eventBus);

  // ─── AI ──────────────────────────────────────────────────────────────────
  // Cached website view: it resolves a reference on every query and history read.
  const ai = new AiService(websiteQuery);

  // ─── Retention ───────────────────────────────────────────────────────────
  // Retention owns the policy; each module deletes its own rows through the
  // `RetentionPurge` port. Order is the order they run per website — analytics and
  // automations first because they are pure SQL, then the two that also clear object
  // storage and therefore take far longer.
  const retention = new RetentionService([
    new AnalyticsRetentionPurge(),
    new AutomationRetentionPurge(),
    new RecordingRetentionPurge(),
    new HeatmapRetentionPurge(),
  ]);

  // ─── Routes ──────────────────────────────────────────────────────────────
  const routes = {
    analytics: createAnalyticsRoutes({
      analytics,
      publicDashboard,
      // Access checks read through the uncached service on purpose — see
      // `CachedWebsiteQuery` on why role lookups are never cached.
      websites,
    }),
    recordings: createRecordingRoutes({ recordings, websites }),
    funnels: createFunnelRoutes({ funnels, websites }),
    websites: createWebsiteRoutes({ websites }),
    tracker: createTrackerRoutes({
      queue: ingest,
      automations,
      automationEvaluation,
      funnels,
      screenshots: heatmapScreenshotService,
      trackerWebsites: {
        resolve: resolveWebsiteForTracker,
        listGoals: listTrackerGoals,
        buildConfig: buildPublicTrackerConfig,
      },
    }),
    heatmaps: createHeatmapRoutes({
      heatmaps,
      screenshots: heatmapScreenshotService,
      websites,
    }),
    automations: createAutomationRoutes({ automations, websites }),
    ai: createAiRoutes({ ai }),
    // Reuses ingest's sinks: the internal collectors write to the same four targets.
    internal: createInternalRoutes({ sinks: ingestSinks, retention }),
  };

  return {
    eventBus,
    outboxPublisher,
    websites,
    websiteQuery,
    analytics,
    recordings,
    funnels,
    heatmaps,
    automations,
    heatmapScreenshots,
    ingest,
    ai,
    retention,
    routes,

    async start() {
      // One-time initialisation that has to happen before traffic is served.
      await initMaxMindGeo(cfg.maxmind);
      configureTrackerWebsiteCache(cfg);
      configureTrackerOriginCache(cfg);
      if (cfg.screenshotCache.enabled) {
        initializeScreenshotCache(cfg.screenshotCache.ttlMs, cfg.screenshotCache.maxEntries);
      }
      // The heatmap engine takes the bus, so it must be constructed from the composed
      // graph rather than lazily on first use.
      initHeatmapEngine(eventBus);

      outboxPublisher.start();
      ingest.start();
      startScheduler(cfg, { heatmapScreenshots, retention });

      logger.info({
        msg: "modules_started",
        modules: [
          "websites", "analytics", "recordings", "funnels",
          "heatmaps", "automations", "ai", "ingest",
        ],
      });
    },

    async stop() {
      // Order is load-bearing. Stop accepting scheduled work, drain the ingest
      // buffers into the engines, and only then shut the engines down — reversing
      // the last two would discard whatever the flush just handed them.
      stopScheduler();

      ingest.stop();
      await ingest.flushNow();

      for (const [name, shutdown] of [
        ["replay", () => getReplayEngine().shutdown()],
        ["heatmap", () => getHeatmapEngine().shutdown()],
      ] as const) {
        try {
          await shutdown();
        } catch (e) {
          // Logged, not rethrown: a stuck engine must not prevent the outbox from
          // draining or the process from exiting.
          logger.error({ msg: `${name}_shutdown_error`, err: String(e) });
        }
      }

      await outboxPublisher.stop();
      websiteQuery.clear();
    },
  };
}
