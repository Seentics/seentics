import { z } from "zod";
import { zNonEmptyString } from "./validation";

export const funnelsActiveQuerySchema = z.object({
  website_id: zNonEmptyString.max(64).optional(),
  websiteId: zNonEmptyString.max(64).optional(),
});

export const funnelsUpsertBodySchema = z.record(z.unknown());

export const funnelsBulkDeleteSchema = z.object({
  ids: z.array(zNonEmptyString.max(128)).max(500).optional().default([]),
});

