import { z } from "zod";
import { zNonEmptyString } from "./validation";

export const automationsUpsertBodySchema = z.record(z.unknown());

export const automationsBulkDeleteSchema = z.object({
  ids: z.array(zNonEmptyString.max(128)).max(500).optional().default([]),
});

