import { z } from "zod";
import { zBoundedInt, zNonEmptyString } from "./validation";

export const replayListQuerySchema = z.object({
  limit: zBoundedInt({ min: 1, max: 200, defaultValue: 20 }),
  offset: zBoundedInt({ min: 0, max: 1_000_000, defaultValue: 0 }),
});

export const replayBatchDeleteSchema = z.object({
  sessionIds: z.array(zNonEmptyString.max(128)).min(1).max(500),
});

