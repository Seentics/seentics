import { z } from "zod";
import { zNonEmptyString } from "./validation";

export const trackerCollectSchema = z
  .object({
    website_id: zNonEmptyString.max(64),
    events: z.array(z.unknown()).optional(),
    session: z.array(z.unknown()).optional(),
    heatmaps: z.array(z.unknown()).optional(),
    heatmap_screenshot: z.array(z.unknown()).optional(),
    funnels: z.array(z.unknown()).optional(),
    automations: z.array(z.unknown()).optional(),
  })
  .passthrough();

