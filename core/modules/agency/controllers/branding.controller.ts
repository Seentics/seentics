import { ok, parseBody } from "../lib/envelope";
import { presentWhiteLabel } from "../lib/presenters";
import { brandingBodySchema, toWhiteLabelPatch } from "../validators/agency.schema";
import { handle, type AgencyControllerDeps } from "./agency-controller.types";

/**
 * The agency's white label. There is no owner in the path: a caller only ever reads or
 * writes the agency the gateway named.
 *
 *   GET /branding   the settings, or the defaults (`updated_at: null`) when never saved
 *   PUT /branding   any subset of the fields; `""` (or `null`) clears a text field, `slug: null`
 *                   frees the slug. A slug another agency holds → 409 conflict.
 */

export function getBranding(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => ok(c, presentWhiteLabel(await deps.whiteLabel.get(ownerId))));
}

export function putBranding(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const body = await parseBody(c, brandingBodySchema);
    if (!body.ok) return body.res;
    return ok(c, presentWhiteLabel(await deps.whiteLabel.update(ownerId, toWhiteLabelPatch(body.data))));
  });
}
