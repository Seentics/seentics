import { z } from "zod";
import { zBoundedInt } from "./validation";

export const analyticsRecentActivityQuerySchema = z.object({
  limit: zBoundedInt({ min: 1, max: 100, defaultValue: 50 }),
  within_minutes: zBoundedInt({ min: 1, max: 24 * 60 }).optional(),
});

