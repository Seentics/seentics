import { z } from "zod";
import { zNonEmptyString } from "../../../platform/validation";

/**
 * `/api/v1/funnels/active` accepts either spelling of the parameter.
 *
 * Both are optional here and the presence check lives in the route, because
 * "neither was sent" has to answer 400 with `website_id required` — a schema-level
 * refinement would answer with a field-error body the tracker does not parse.
 */
export const funnelsActiveQuerySchema = z.object({
  website_id: zNonEmptyString.max(64).optional(),
  websiteId: zNonEmptyString.max(64).optional(),
});

/**
 * Funnel create/update body.
 *
 * Intentionally unvalidated beyond "is an object". `steps` is free-form JSONB whose
 * shape the builder has changed several times, and the repository already normalizes
 * every field it reads (`mapSteps`). Tightening this schema would reject saves from
 * older builder bundles that the repository handles fine.
 */
export const funnelsUpsertBodySchema = z.record(z.unknown());

export const funnelsBulkDeleteSchema = z.object({
  ids: z.array(zNonEmptyString.max(128)).max(500).optional().default([]),
});
