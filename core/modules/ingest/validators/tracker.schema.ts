import { z } from "zod";
import { zNonEmptyString } from "../../../platform/validation";

const zHeatmapEvent = z.object({
  type: z.enum(["heatmap_click", "heatmap_scroll"]),
  data: z
    .object({
      nx: z.number().min(0).max(1).optional(),
      ny: z.number().min(0).max(1).optional(),
      depth: z.number().min(0).max(1).optional(),
      target: z.string().max(256).optional(),
      vw: z.number().int().positive().max(10_000).optional(),
      vh: z.number().int().positive().max(10_000).optional(),
      page_version: z.string().max(160).optional(),
      target_locator: z.record(z.unknown()).optional(),
      target_rect: z.record(z.unknown()).optional(),
      relative_x: z.number().min(0).max(1).optional(),
      relative_y: z.number().min(0).max(1).optional(),
      position_mode: z.enum(["normal", "fixed", "sticky"]).optional(),
      client_x: z.number().min(-100_000).max(100_000).optional(),
      client_y: z.number().min(-100_000).max(100_000).optional(),
      page_x: z.number().min(-100_000).max(10_000_000).optional(),
      page_y: z.number().min(-100_000).max(10_000_000).optional(),
      scroll_x: z.number().min(-100_000).max(10_000_000).optional(),
      scroll_y: z.number().min(-100_000).max(10_000_000).optional(),
      document_width: z.number().int().min(100).max(10_000).optional(),
      document_height: z.number().int().min(100).max(1_000_000).optional(),
      device_pixel_ratio: z.number().min(0.1).max(16).optional(),
      tracker_version: z.string().max(32).optional(),
      schema_version: z.number().int().min(1).max(100).optional(),
    })
    .passthrough(),
  ts: z.number(),
  url: z.string().max(2048),
  sid: z.string().max(128),
  vid: z.string().max(128).optional(),
});

const zHeatmapScreenshotEvent = z.object({
  type: z.literal("heatmap_screenshot"),
  data: z.object({ image: z.string().max(3_500_000) }).passthrough(),
  ts: z.number(),
  url: z.string().max(2048),
  sid: z.string().max(128),
  vid: z.string().max(128).optional(),
  doc_w: z.number().int().optional(),
  doc_h: z.number().int().optional(),
});

const zHeatmapDomSnapshotEvent = z.object({
  type: z.literal("heatmap_dom_snapshot"),
  // Kept above the tracker's own 3 MB ceiling (`MAX_DOM_SNAPSHOT_BYTES`) on purpose: a
  // field over its limit fails the whole batch, so the tracker's check must be the one
  // that bites. The gap is headroom for an older tracker still caching on a customer CDN.
  data: z.object({ html: z.string().max(3_500_000) }).passthrough(),
  ts: z.number(),
  url: z.string().max(2048),
  sid: z.string().max(128),
  vid: z.string().max(128).optional(),
  doc_w: z.number().int().optional(),
  doc_h: z.number().int().optional(),
  vw: z.number().int().optional(),
  vh: z.number().int().optional(),
});

/**
 * An uncaught error or unhandled rejection from a visitor's browser.
 *
 * Bounds are generous next to the other event types because this is the payload someone
 * debugs from: a truncated stack is often a useless one. The tracker caps at 10 per page
 * and deduplicates within it, so the array stays short even on a page throwing in a loop.
 */
const zErrorEvent = z.object({
  type: z.literal("error"),
  kind: z.enum(["error", "unhandledrejection"]).default("error"),
  ts: z.number(),
  url: z.string().max(2048),
  sid: z.string().max(128),
  vid: z.string().max(128).optional(),
  message: z.string().min(1).max(1_000),
  source: z.string().max(500).optional(),
  line_no: z.number().int().optional(),
  col_no: z.number().int().optional(),
  stack: z.string().max(4_000).optional(),
});

export const trackerCollectSchema = z
  .object({
    website_id: zNonEmptyString.max(64),
    events: z.array(z.unknown()).max(2000).optional(),
    session: z.array(z.unknown()).max(5000).optional(),
    heatmaps: z.array(zHeatmapEvent).max(2000).optional(),
    heatmap_screenshot: z.array(zHeatmapScreenshotEvent).max(5).optional(),
    heatmap_dom_snapshot: z.array(zHeatmapDomSnapshotEvent).max(5).optional(),
    errors: z.array(zErrorEvent).max(20).optional(),
    funnels: z.array(z.unknown()).max(500).optional(),
    automations: z.array(z.unknown()).max(500).optional(),
  })
  .passthrough();
