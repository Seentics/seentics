import { z } from "zod";
import { zNonEmptyString } from "./validation";

export const internalCollectAnalyticsSchema = z
  .object({
    website_id: zNonEmptyString.max(64),
    events: z.array(z.unknown()).optional().default([]),
  })
  .passthrough();

export const internalCollectReplayEventsSchema = z
  .object({
    events: z.array(z.record(z.unknown())).min(1).max(200_000),
  })
  .passthrough();

export const internalCollectHeatmapEventsSchema = z
  .object({
    events: z.array(z.record(z.unknown())).min(1).max(200_000),
  })
  .passthrough();

