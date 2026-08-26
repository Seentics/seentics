import type { Funnel } from "../interfaces";
import { listActiveFunnels } from "../repositories/funnel.repository";

/**
 * The funnels half of the tracker's `/init` payload.
 *
 * A free function rather than a method on an injected service because
 * `routes/tracker.ts` is still a module-level router that is not composed in
 * `app/bootstrap.ts`, so there is no constructor to inject into. Same accommodation
 * the recordings module makes with `getReplayEngine`. It stays behind this file
 * instead of `routes/tracker.ts` importing the repository, so the module boundary
 * still holds and the funnels tables have exactly one set of callers.
 *
 * Takes the resolved `websites.id` UUID. `/tracker/init` resolves the website row
 * before it gets here, and the previous version re-resolved that same reference on
 * the hottest public endpoint in the product.
 */
export async function activeFunnelsForTracker(websiteUuid: string): Promise<Funnel[]> {
  return listActiveFunnels(websiteUuid);
}
