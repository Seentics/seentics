import type {
  AutomationTriggerQueued,
  HeatmapIngestEvent,
  TrackerEvent,
} from "../../../platform/lib/types";
import type { AnalyticsIngestWriter } from "../../analytics/interfaces";
import type { AutomationTriggerWriter } from "../../automations/interfaces";
import type { HeatmapIngest, HeatmapTrackerEvent } from "../../heatmaps/interfaces";
import type { RecordingIngest } from "../../recordings/interfaces";
import type { IngestSinks } from "../interfaces";

/**
 * The engines arrive as thunks, resolved on first flush rather than at construction.
 *
 * Both engines start internal flush timers and open storage clients the moment they
 * are constructed. Taking them eagerly would mean merely *composing* the application
 * started background work — so composition would no longer be side-effect free, and
 * anything that builds the graph to inspect it (a test, a health probe) would hang on
 * live timers.
 *
 * The two writers need no thunk: they are stateless and cheap to construct.
 */
type Lazy<T> = () => T;

/**
 * `IngestSinks` wired to the four modules that own the data.
 *
 * All four dependencies are interfaces declared by the modules that implement them,
 * so this file imports no other module's services, repositories or engines. That was
 * the last set of compile-time edges out of ingest: the recordings and heatmap
 * engines came from `getReplayEngine()` / `getHeatmapEngine()` — process-wide
 * singletons — and the analytics and automations writes were direct imports of those
 * modules' batch repositories. None of it could be substituted, so the flush path
 * could not be exercised without a database, an S3 client and two live engines.
 */
export class ModuleIngestSinks implements IngestSinks {
  constructor(
    private readonly analytics: AnalyticsIngestWriter,
    private readonly automations: AutomationTriggerWriter,
    private readonly recordings: Lazy<RecordingIngest>,
    private readonly heatmaps: Lazy<HeatmapIngest>,
  ) {}

  async writeAnalyticsBatch(
    batchId: string,
    websiteId: string,
    events: readonly TrackerEvent[],
  ): Promise<number> {
    return this.analytics.writeBatch(batchId, websiteId, events);
  }

  async writeAutomationTriggers(batchId: string, rows: AutomationTriggerQueued[]): Promise<void> {
    await this.automations.writeTriggers(batchId, rows);
  }

  async processRecordings(batchId: string, events: TrackerEvent[]): Promise<void> {
    await this.recordings().processEvents(batchId, events);
  }

  async processHeatmaps(batchId: string, events: readonly HeatmapTrackerEvent[]): Promise<void> {
    await this.heatmaps().processEvents(batchId, events);
  }
}
