import { z } from "zod";
import { zBoundedInt, zNonEmptyString } from "../../../platform/validation";

/** `?has_errors=1` and `?has_errors=true` both read as on; absent means "don't filter". */
const zFlag = z
  .union([z.literal("1"), z.literal("true"), z.literal("0"), z.literal("false")])
  .optional()
  .transform((v) => (v === "1" || v === "true" ? true : undefined));

export const replayListQuerySchema = z.object({
  limit: zBoundedInt({ min: 1, max: 200, defaultValue: 20 }),
  offset: zBoundedInt({ min: 0, max: 1_000_000, defaultValue: 0 }),
  /** Bounded so the ILIKE predicate cannot be handed an unbounded string. */
  search: z.string().trim().max(128).optional(),
  device: z.enum(["desktop", "mobile", "tablet"]).optional(),
  has_errors: zFlag,
  has_rage_clicks: zFlag,
});

export const replayBatchDeleteSchema = z.object({
  sessionIds: z.array(zNonEmptyString.max(128)).min(1).max(500),
});
