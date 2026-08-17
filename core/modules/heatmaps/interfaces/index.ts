/**
 * Public contracts for the heatmaps module.
 *
 * Consumers should import from here and never from `../services` or
 * `../repositories`: the services are the only callers of the repositories, which
 * is what enforces that a website reference is resolved exactly once per request
 * (see `HeatmapService`).
 */
export type {
  BatchCaptureScreenshotResult,
  CaptureScreenshotRequest,
  CaptureScreenshotResult,
  HeatmapIngest,
  HeatmapIngestEventInput,
  HeatmapLayout,
  HeatmapMutations,
  HeatmapPageSummary,
  HeatmapPointOut,
  HeatmapQuery,
  HeatmapScreenshotCapture,
  HeatmapScreenshotMaintenance,
  HeatmapSettings,
  ResolvedWebsite,
} from "./heatmap.interface";
