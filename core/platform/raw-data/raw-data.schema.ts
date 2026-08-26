import { z } from "zod";
import { zBoundedInt, zNonEmptyString } from "../../platform/validation";

export const rawRecentActivityQuerySchema = z.object({
  limit: zBoundedInt({ min: 1, max: 500, defaultValue: 50 }),
});

export const rawEventsQuerySchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  limit: zBoundedInt({ min: 1, max: 1000, defaultValue: 100 }),
  offset: zBoundedInt({ min: 0, max: 1_000_000, defaultValue: 0 }),
  event_type: z.string().trim().max(128).optional(),
});

export const rawSessionsQuerySchema = z.object({
  limit: zBoundedInt({ min: 1, max: 500, defaultValue: 50 }),
  offset: zBoundedInt({ min: 0, max: 1_000_000, defaultValue: 0 }),
});

export const rawHeatmapPointsQuerySchema = z.object({
  page_path: zNonEmptyString.max(2048),
  event_type: z.string().trim().max(32).optional().default("click"),
});

