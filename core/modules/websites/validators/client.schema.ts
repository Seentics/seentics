import { z } from "zod";
import { zNonEmptyString } from "../../../platform/validation";
import { CLIENT_FEATURES, CLIENT_LIMITS, CLIENT_STATUSES } from "../interfaces/client.interface";
import type { CreateClientInput, UpdateClientInput } from "../interfaces/client.interface";

/** `{ replays: false, … }` — only known features, any subset. */
const featuresSchema = z
  .object(Object.fromEntries(CLIENT_FEATURES.map((f) => [f, z.boolean().optional()])) as Record<string, z.ZodOptional<z.ZodBoolean>>)
  .strict();

/** `{ max_replays: 100, … }` — a whole number ≥ 0, or `null` for uncapped. */
const limitsSchema = z
  .object(
    Object.fromEntries(CLIENT_LIMITS.map((l) => [l, z.number().int().min(0).nullable().optional()])) as Record<
      string,
      z.ZodOptional<z.ZodNullable<z.ZodNumber>>
    >,
  )
  .strict();

/** Free-form tags for the caller's own use; bounded so it cannot become a blob store. */
const metadataSchema = z
  .record(z.unknown())
  .refine((m) => JSON.stringify(m).length <= 4096, "metadata must be at most 4 KB of JSON");

const clientFields = {
  name: zNonEmptyString.max(120),
  external_id: z.string().trim().min(1).max(255).nullable().optional(),
  company: z.string().trim().max(200).optional(),
  email: z.string().trim().max(320).optional(),
  website_url: z.string().trim().max(2048).optional(),
  note: z.string().max(2000).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  features_enabled: featuresSchema.optional(),
  limits: limitsSchema.optional(),
  metadata: metadataSchema.optional(),
};

/**
 * Unknown keys are dropped, not rejected: the dashboard sends fields Core does not keep.
 *
 * `website` is optional — a client can be created first and given sites later — but a
 * website is always created with both a name and a URL, here as on `POST /websites`.
 */
export const clientCreateSchema = z.object({
  ...clientFields,
  website: z.object({ name: zNonEmptyString.max(120), url: zNonEmptyString.max(2048) }).optional(),
});

export const clientUpdateSchema = z.object({ ...clientFields, name: clientFields.name.optional() });

export const assignWebsiteSchema = z.object({
  // The dashboard sends camelCase here; the management API snake_case.
  websiteId: z.string().uuid().optional(),
  website_id: z.string().uuid().optional(),
}).refine((b) => b.websiteId || b.website_id, "website_id is required");

export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

type ClientBody = z.infer<typeof clientUpdateSchema>;

/** Wire body (snake_case) → domain input; absent stays absent. */
export function toClientInput(body: ClientBody): UpdateClientInput {
  const out: UpdateClientInput = {};
  if (body.name !== undefined) out.name = body.name;
  if (body.external_id !== undefined) out.externalId = body.external_id;
  if (body.company !== undefined) out.company = body.company;
  if (body.email !== undefined) out.email = body.email;
  if (body.website_url !== undefined) out.websiteUrl = body.website_url;
  if (body.note !== undefined) out.note = body.note;
  if (body.status !== undefined) out.status = body.status;
  if (body.features_enabled !== undefined) out.featuresEnabled = body.features_enabled;
  if (body.limits !== undefined) out.limits = body.limits;
  if (body.metadata !== undefined) out.metadata = body.metadata;
  return out;
}

export function toCreateClientInput(body: z.infer<typeof clientCreateSchema>): CreateClientInput {
  return { ...toClientInput(body), name: body.name };
}
