import { normalizeHeatmapPagePath } from "../lib/paths";
import type { HeatmapMutations } from "../interfaces";
import { env } from "../../../config";
import { deleteS3Objects } from "../../../platform/storage/s3";
import { deleteHeatmapPageSnapshots, deleteHeatmaps, heatmapPageObjectKeys } from "../repositories/heatmap-writes.repository";
import { decodeJpegUpload, storeDashboardScreenshot } from "./heatmap-layout-snapshot.service";

/** Dashboard-authenticated screenshot and deletion operations. */
export class HeatmapMutationService implements HeatmapMutations {
  async saveDashboardScreenshot(
    websiteId: string,
    pagePath: string,
    imageBase64: string,
    docWidth: number,
    docHeight: number,
  ): Promise<void> {
    const normalizedPath = normalizeHeatmapPagePath(pagePath);
    const jpeg = decodeJpegUpload(imageBase64);
    await storeDashboardScreenshot(websiteId, normalizedPath, jpeg, docWidth, docHeight);
  }

  /**
   * The page's clicks, and its backgrounds: deleting only the points left every screenshot
   * and copy of the page in storage, and the page still showed its background afterwards.
   * Objects before rows, so a failed object delete leaves rows that can find them again.
   */
  async bulkDeletePages(websiteId: string, pagePaths: string[]): Promise<void> {
    // Points by the paths as sent and as stored: "/gone/" must remove the points kept under
    // "/gone", or the page kept its clicks while losing its background.
    const normalized = [...new Set(pagePaths.map(normalizeHeatmapPagePath))];
    await deleteHeatmaps(websiteId, [...new Set([...pagePaths, ...normalized])]);
    const keys = await heatmapPageObjectKeys(websiteId, normalized);
    if (keys.length) await deleteS3Objects(env().s3.heatmapBucket, keys);
    await deleteHeatmapPageSnapshots(websiteId, normalized);
  }
}
