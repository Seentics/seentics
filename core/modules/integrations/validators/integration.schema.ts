import { z } from "zod";
import { PROVIDER_IDS } from "../interfaces";

const name = z.string().trim().max(80);

/** Credentials and config are validated by each provider's own schema; here only the envelope. */
export const connectSchema = z.object({
  provider: z.enum(PROVIDER_IDS),
  name: name.optional(),
  credentials: z.record(z.unknown()),
  config: z.record(z.unknown()).default({}),
});

export const updateSchema = z
  .object({
    name: name.optional(),
    enabled: z.boolean().optional(),
    config: z.record(z.unknown()).optional(),
    credentials: z.record(z.unknown()).optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.enabled !== undefined || v.config !== undefined || v.credentials !== undefined,
    "Nothing to update",
  );

export const deliveriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["pending", "success", "failed", "skipped"]).optional(),
  connection_id: z.string().uuid().optional(),
});
