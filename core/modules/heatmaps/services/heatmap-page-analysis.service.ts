import { extractPath, normalizeHeatmapPagePath } from "../lib/paths";
import type { HeatmapInsightDevice, HeatmapPageAnalysis, HeatmapPageAnalysisReads } from "../interfaces";
import { readClickRows, readScrollRows } from "../repositories/heatmap-insights.repository";
import { DEFAULT_DAYS, analysePage, type ClickRow, type ScrollRow } from "../lib/heatmap-insights";

/** Where the rows come from. A port so the service is tested without a database. */
export type HeatmapInsightRowSource = {
  scroll(websiteId: string, pagePath: string, days: number): Promise<ScrollRow[]>;
  clicks(websiteId: string, pagePath: string, days: number): Promise<ClickRow[]>;
};

const postgresRows: HeatmapInsightRowSource = { scroll: readScrollRows, clicks: readClickRows };

/** The deterministic page analysis: two grouped reads, then `analysePage`. */
export class HeatmapPageAnalysisService implements HeatmapPageAnalysisReads {
  constructor(private readonly rows: HeatmapInsightRowSource = postgresRows) {}

  async analyzePage(
    websiteId: string,
    pagePath: string,
    opts: { days?: number; device?: HeatmapInsightDevice } = {},
  ): Promise<HeatmapPageAnalysis> {
    const days = Math.max(1, Math.min(366, Math.trunc(opts.days ?? DEFAULT_DAYS) || DEFAULT_DAYS));
    const device = opts.device ?? "all";
    // A full URL is accepted too (the assistant may pass one): its path is what is stored.
    const path = normalizeHeatmapPagePath(extractPath(pagePath));
    const [scrollRows, clickRows] = await Promise.all([
      this.rows.scroll(websiteId, path, days),
      this.rows.clicks(websiteId, path, days),
    ]);
    return analysePage({ pagePath: path, days, device, scrollRows, clickRows });
  }
}
