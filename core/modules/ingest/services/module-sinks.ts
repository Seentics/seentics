import type {
  AnalyticsIngestEvent,
  AutomationTriggerQueued,
  HeatmapIngestEvent,
  TrackerEvent,
} from "../../../platform/lib/types";
import { ingestAnalyticsBatch } from "../../analytics/repositories/analytics-batch.repository";
import { ingestAutomationTriggersBatch } from "../../automations/repositories/automation-batch.repository";
import type { IngestSinks } from "../interfaces";

/** What the recordings engine has to offer for ingest to use it. */
type RecordingProcessor = { processEvents(events: TrackerEvent[]): Promise<void> };

/** What the heatmap engine has to offer. */
type HeatmapProcessor = { processEvents(events: HeatmapIngestEvent[]): Promise<void> };

/**
 * The engines are supplied as thunks, resolved on first flush rather than at
 * construction.
 *
 * Both engines start internal flush timers and open storage clients the moment they
 * are constructed. Taking them eagerly would mean merely *composing* the application
 * started background work — so `bootstrap()` would no longer be side-effect free, and
 * anything that builds the graph to inspect it (a test, a health probe) would hang on
 * live timers.
 */
type Lazy<T> = () => T;

/**
 * `IngestSinks` wired to the four modules that own the data.
 *
 * The engines arrive as constructor arguments rather than through
 * `getReplayEngine()` / `getHeatmapEngine()`. That was the last place ingest reached
 * into another module's singleton, and it is why the flush path could not be tested
 * without standing up two real engines.
 *
 * The analytics and automations writes are still module functions rather than
 * injected ports. They are stateless batch inserts with no lifecycle to own, so
 * wrapping them in classes purely to inject them would add indirection without
 * buying isolation — the queue service is already testable through `IngestSinks`.
 */
export class ModuleIngestSinks implements IngestSinks {
  constructor(
    private readonly recordings: Lazy<RecordingProcessor>,
    private readonly heatmaps: Lazy<HeatmapProcessor>,
  ) {}

  async writeAnalyticsBatch(siteId: string, events: AnalyticsIngestEvent[]): Promise<number> {
    return ingestAnalyticsBatch(siteId, events);
  }

  async writeAutomationTriggers(rows: AutomationTriggerQueued[]): Promise<void> {
    await ingestAutomationTriggersBatch(rows);
  }

  async processRecordings(events: TrackerEvent[]): Promise<void> {
    await this.recordings().processEvents(events);
  }

  async processHeatmaps(events: HeatmapIngestEvent[]): Promise<void> {
    await this.heatmaps().processEvents(events);
  }
}
