import { z } from "zod";
import { zNonEmptyString, zUuid } from "../../../platform/validation";

export const AI_DOMAINS = ["analytics", "revenue", "replays", "heatmaps", "funnels", "automations"] as const;

export const aiQueryBodySchema = z.object({
  prompt: zNonEmptyString.max(500, "prompt too long (max 500 chars)"),
  domain: z.enum(AI_DOMAINS).optional().default("analytics"),
});

export const aiQueryParamsSchema = z.object({
  website_id: zUuid,
});
