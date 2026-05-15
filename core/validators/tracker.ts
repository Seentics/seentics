import { z } from "zod";
import { zNonEmptyString } from "./validation";

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

export const trackerCollectSchema = z
  .object({
    website_id: zNonEmptyString.max(64),
    events: z.array(z.unknown()).max(2000).optional(),
    session: z.array(z.unknown()).max(5000).optional(),
    heatmaps: z.array(zHeatmapEvent).max(2000).optional(),
    heatmap_screenshot: z.array(zHeatmapScreenshotEvent).max(5).optional(),
    funnels: z.array(z.unknown()).max(500).optional(),
    automations: z.array(z.unknown()).max(500).optional(),
  })
  .passthrough();

