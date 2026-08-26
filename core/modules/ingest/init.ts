import type { EventBus } from "../../infrastructure/events";
import { log as baseLog, type Logger } from "../../platform/lib/logger";
import type { AnalyticsModule } from "../analytics/interfaces";
import type { AutomationsModule } from "../automations/interfaces";
import type { FunnelsModule } from "../funnels/interfaces";
import type { HeatmapsModule } from "../heatmaps/interfaces";
import type { RecordingsModule } from "../recordings/interfaces";
import type { WebsitesModule } from "../websites/interfaces";
import type { IngestModule } from "./interfaces";
import { createTrackerRoutes } from "./routes";
import { IngestQueueService } from "./services/ingest-queue.service";
import { IngestWorker } from "./services/ingest-worker.service";
import { postgresBatchQueue } from "./repositories/postgres-batch-queue";
import { ModuleIngestSinks } from "./services/module-sinks";

/**
 * Build the ingest module.
 *
 * Ingest depends on more modules than anything else here — it is the write half of the
 * product, sorting a mixed tracker batch and handing each category to whoever owns the
 * data — so this is where taking modules whole pays off most: five module objects
 * instead of nine unpacked capabilities, and every member of each is still an
 * interface.
 *
 * The two engines arrive as the modules' own `ingest()` getters. Both arm flush timers
 * and open storage clients on construction, so resolving them here would mean building
 * the graph started background work.
 */
export function initIngestModule(deps: {
  analyticsModule: AnalyticsModule;
  automationsModule: AutomationsModule;
  recordingsModule: RecordingsModule;
  heatmapsModule: HeatmapsModule;
  funnelsModule: FunnelsModule;
  /** For its tracker-facing lookup — anonymous, heavily cached, not `WebsiteQuery`. */
  websitesModule: WebsitesModule;
  eventBus: EventBus;
  logger?: Logger;
}): IngestModule {
  const sinks = new ModuleIngestSinks(
    deps.analyticsModule.ingest,
    deps.automationsModule.triggers,
    deps.recordingsModule.ingest,
    deps.heatmapsModule.ingest,
  );
  // The queue enqueues; the worker applies. Splitting them is what puts a committed row
  // between the tracker request and the module writes, so a crash costs at most the
  // batches in flight rather than every in-memory buffer.
  const queue = new IngestQueueService(postgresBatchQueue, deps.eventBus, deps.logger ?? baseLog);
  const worker = new IngestWorker(
    postgresBatchQueue,
    sinks,
    deps.eventBus,
    deps.logger ?? baseLog,
  );

  return {
    sinks,
    routes: createTrackerRoutes({
      queue,
      automations: deps.automationsModule.trackerSettings,
      automationEvaluation: deps.automationsModule.evaluation,
      funnels: deps.funnelsModule.trackerConfig,
      screenshots: deps.heatmapsModule.screenshots,
      trackerWebsites: deps.websitesModule.trackerWebsites,
    }),

    start(cfg) {
      queue.configure(cfg);
      queue.start();
      worker.start();
    },

    /**
     * Stop the timer, then drain.
     *
     * Both, in that order: `stop` only clears the interval, so without the explicit
     * `flushNow` everything still buffered is lost — that is the durability trade this
     * module makes, and shutdown is the one place it is recoverable.
     *
     * The engines are shut down after this returns, by their own modules. Reversing the
     * two would discard whatever this flush just handed them.
     */
    /**
     * Stop the timer, drain the buffers onto the queue, then drain the queue.
     *
     * All three, in that order. Stopping without `flushNow` loses whatever is still
     * buffered; enqueueing without draining leaves committed batches for the next boot to
     * pick up — survivable, but a clean shutdown should hand over an empty queue.
     */
    async stop() {
      queue.stop();
      await queue.flushNow();
      await worker.stop();
      await worker.drainOnce();
    },
  };
}
