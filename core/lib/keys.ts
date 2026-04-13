import { createHash } from "node:crypto";

export function layoutPathSlot(siteId: string, normPath: string): string {
  const h = createHash("sha256").update(normPath).digest();
  return `${siteId}_${h.subarray(0, 12).toString("hex")}`;
}

export function heatmapScreenshotKey(siteId: string, pathSlot: string): string {
  return `heatmap-screenshots/${siteId}/${pathSlot}.jpg`;
}
