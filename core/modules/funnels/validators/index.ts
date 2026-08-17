/**
 * Request validation for the funnels HTTP surface.
 *
 * `routes.ts` imports from `./validators/funnel.schema` directly rather than through
 * this barrel — see the note there on how a re-export widens the inferred output of
 * schemas with defaults and costs the handlers their parameter types.
 */
export {
  funnelsActiveQuerySchema,
  funnelsBulkDeleteSchema,
  funnelsUpsertBodySchema,
} from "./funnel.schema";
