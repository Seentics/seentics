import { z } from "zod";

/** Credentials and config are validated by each provider's own schema; here only the envelope. */
export const connectSchema = z.object({
  credentials: z.record(z.unknown()),
  config: z.record(z.unknown()).default({}),
});

export const updateSchema = z
  .object({
    enabled: z.boolean().optional(),
    config: z.record(z.unknown()).optional(),
    credentials: z.record(z.unknown()).optional(),
  })
  .refine((v) => v.enabled !== undefined || v.config !== undefined || v.credentials !== undefined, "Nothing to update");

export const deliveriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
