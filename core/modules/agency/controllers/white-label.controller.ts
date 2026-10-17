import { parseJson } from "../../../platform/validation";
import type { WhiteLabel } from "../interfaces";
import { presentWhiteLabel } from "../lib/presenters";
import { toWhiteLabelPatch, whiteLabelPatchSchema } from "../validators/agency.schema";
import { guarded } from "./guarded";

/**
 * `/user/agency/white-label`: the signed-in user's own agency brand. There is no owner in
 * the path, so a caller can only ever read or write their own.
 */

export type WhiteLabelControllerDeps = { whiteLabel: WhiteLabel };

/** The settings, or the defaults (`updated_at: null`) when never saved. */
export function getWhiteLabel(deps: WhiteLabelControllerDeps) {
  return guarded(async (c, ownerId) => c.json({ data: presentWhiteLabel(await deps.whiteLabel.get(ownerId)) }));
}

/** Partial: absent fields keep their value, `""` clears a text field. */
export function updateWhiteLabel(deps: WhiteLabelControllerDeps) {
  return guarded(async (c, ownerId) => {
    const parsed = await parseJson(c, whiteLabelPatchSchema);
    if (!parsed.ok) return parsed.res;
    const saved = await deps.whiteLabel.update(ownerId, toWhiteLabelPatch(parsed.data));
    return c.json({ data: presentWhiteLabel(saved) });
  });
}
