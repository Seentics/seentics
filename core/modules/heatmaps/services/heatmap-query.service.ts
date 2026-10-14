import { log } from "../../../platform/observability/logger";
import { coerceSnapshotDeviceBucket } from "../lib/device";
import { normalizeHeatmapPagePath } from "../lib/paths";
import type {
  HeatmapLayout,
  HeatmapPageSummary,
  HeatmapPointOut,
  HeatmapQuery,
  HeatmapSettings,
} from "../interfaces";
import type { HeatmapAutoCapture } from "./heatmap-auto-capture.service";
import type { StylesheetAccess } from "../../recordings/interfaces";
import { readLayoutSnapshot } from "./heatmap-layout-snapshot.service";
import { getHeatmapPoints, listHeatmapPages } from "./heatmap-page-query.service";

/** Dashboard heatmap reads. Website access is checked by the controller. */
export class HeatmapQueryService implements HeatmapQuery {
  constructor(
    private readonly settings: HeatmapSettings,
    private readonly autoCapture: HeatmapAutoCapture,
    /** Issues the token a DOM snapshot's viewer loads archived stylesheets with. */
    private readonly stylesheets: StylesheetAccess | null = null,
  ) {}

  listPages(websiteId: string, days?: number): Promise<{ pages: HeatmapPageSummary[] }> {
    return listHeatmapPages(websiteId, days);
  }

  getPoints(
    websiteId: string,
    pagePath: string,
    eventType: string,
    days?: number,
  ): Promise<{ page_path: string; points: HeatmapPointOut[] }> {
    return getHeatmapPoints(websiteId, pagePath, eventType, days);
  }

  async getLayoutSnapshot(
    websiteId: string,
    pagePath: string,
    device?: string,
  ): Promise<{ layout: HeatmapLayout | null }> {
    const target = await this.settings.getCaptureTarget(websiteId);
    const resolved = target ?? { websiteId, siteUrl: "", layoutEnabled: false };
    const normalizedPath = normalizeHeatmapPagePath(pagePath);
    const deviceBucket = coerceSnapshotDeviceBucket(device);
    const snapshot = await readLayoutSnapshot(websiteId, normalizedPath, deviceBucket);
    if (snapshot.missing) {
      log.info({ msg: "heatmap_snapshot_miss", website_uuid: websiteId, normalizedPath, device: deviceBucket });
      if (target) this.autoCapture.schedule(resolved, normalizedPath);
      return { layout: null };
    }
    if (snapshot.stale && target) this.autoCapture.schedule(resolved, normalizedPath, true);
    const layout = snapshot.layout;
    if (layout?.html_url && this.stylesheets) {
      const access = this.stylesheets.accessToken(websiteId);
      return { layout: { ...layout, stylesheet_token: access.token, stylesheet_token_expires_at: access.expiresAt } };
    }
    return { layout };
  }
}
