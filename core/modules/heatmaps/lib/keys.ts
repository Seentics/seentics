import { createHash } from "node:crypto";

export function layoutPathSlot(websiteId: string, normPath: string): string {
  const h = createHash("sha256").update(normPath).digest();
  return `${websiteId}_${h.subarray(0, 12).toString("hex")}`;
}

export function heatmapScreenshotKey(websiteId: string, pathSlot: string): string {
  return `heatmap-screenshots/${websiteId}/${pathSlot}.jpg`;
}

export function heatmapHtmlSnapshotKey(websiteId: string, pathSlot: string): string {
  return `heatmap-screenshots/${websiteId}/${pathSlot}.html`;
}
