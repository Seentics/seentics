import type { EventBus } from "../../infrastructure/events";
import type { WebsitesModule } from "../websites/interfaces";
import type { RecordingsModule } from "./interfaces";
import { RecordingUsageCounter } from "./services/usage-count.service";
import { createRecordingRoutes } from "./routes";
import { RecordingRawReadService } from "./services/raw-reads.service";
import {
  getReplayEngine,
  initReplayEngine,
  stopReplayEngine,
} from "./services/recording-engine.service";
import { RecordingService } from "./services/recording.service";
import { RecordingRetentionPurge } from "./services/retention-purge.service";

/** Build the recordings module. */
export function initRecordingsModule(deps: {
  websitesModule: WebsitesModule;
  eventBus: EventBus;
}): RecordingsModule {
  const recordings = new RecordingService(deps.websitesModule.query, deps.eventBus);

  return {
    // `getReplayEngine()` is this module's own accessor. Keeping the call in here is
    // what removed ingest's reach into a process-wide singleton it could not stub.
    ingest: () => getReplayEngine(),
    retention: new RecordingRetentionPurge(),
    usage: new RecordingUsageCounter(),
    rawReads: new RecordingRawReadService(),
    routes: createRecordingRoutes({
      recordings,
      websites: deps.websitesModule.accessChecks,
    }),

    // Constructing the engine arms flush timers and opens an S3 client, so it happens
    // here rather than at build time — same reason as the heatmap engine. Idempotent:
    // an ingest that beat `start()` already built one, and replacing it would strand
    // that engine's timer and its buffered events.
    start() {
      initReplayEngine();
    },

    // Never constructs one just to tear it down — `getReplayEngine().shutdown()` would.
    async stop() {
      await stopReplayEngine();
    },
  };
}
