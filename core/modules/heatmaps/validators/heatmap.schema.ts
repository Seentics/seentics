import { z } from "zod";
import { zNonEmptyString } from "./validation";

export const heatmapDataQuerySchema = z.object({
  page_path: zNonEmptyString.max(2048),
  event_type: z.enum(["click", "scroll"]).optional().default("click"),
});

export const heatmapSnapshotQuerySchema = z.object({
  page_path: zNonEmptyString.max(2048),
});

export const heatmapBulkDeleteSchema = z.object({
  pagePaths: z.array(zNonEmptyString.max(2048)).min(1).max(500),
});

