import type { WebsiteQuery } from "../../websites/interfaces";
import type {
  HeatmapInsightNarrator,
  HeatmapMutations,
  HeatmapPageAnalysisReads,
  HeatmapQuery,
  HeatmapScreenshotCapture,
} from "../interfaces";

export type HeatmapControllerDeps = {
  heatmapQueries: HeatmapQuery;
  heatmapMutations: HeatmapMutations;
  screenshots: HeatmapScreenshotCapture;
  websites: WebsiteQuery;
  /**
   * Page insights. `narrator` is read per request: the module that words insights is built
   * after this one, and returns `null` when there is none (wording then comes from templates).
   * Absent entirely, the insights routes answer 503.
   */
  insights?: {
    analysis: HeatmapPageAnalysisReads;
    narrator: () => HeatmapInsightNarrator | null;
  };
};
