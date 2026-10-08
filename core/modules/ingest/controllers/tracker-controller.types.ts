import type {
  AutomationEvaluation,
  AutomationTrackerSettings,
} from "../../automations/interfaces";
import type { FunnelTrackerConfig } from "../../funnels/interfaces";
import type { HeatmapScreenshotCapture, HeatmapSnapshotDemand } from "../../heatmaps/interfaces";
import type { TrackerWebsites } from "../../websites/interfaces";
import type { TrackerCollectService } from "../interfaces";

export type TrackerControllerDeps = {
  collect: TrackerCollectService;
  automations: AutomationTrackerSettings;
  automationEvaluation: AutomationEvaluation;
  funnels: FunnelTrackerConfig;
  screenshots: HeatmapScreenshotCapture;
  /** For `/snapshot-needed`: which visitor captures a page's heatmap background. */
  snapshotDemand: HeatmapSnapshotDemand;
  trackerWebsites: TrackerWebsites;
  /** Today's anonymous-visitor salt (platform/privacy/visitor-salt.ts). */
  visitorSalt: () => Promise<Buffer>;
};
