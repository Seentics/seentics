import { notFound, ok, parseQuery } from "../lib/envelope";
import { presentAlert, presentOverview } from "../lib/presenters";
import { overviewQuerySchema } from "../validators/agency.schema";
import { handle, idParam, type AgencyControllerDeps } from "./agency-controller.types";

/**
 * The workspace's landing screen.
 *
 *   GET  /overview?period=7d|30d|90d   totals across every site, per client, top movers, open alerts
 *   POST /alerts/:id/dismiss           → the alert, `dismissed_at` set
 *   GET  /setup                        → `{ steps: [{ id, done }] }`
 */

export function getOverview(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const q = parseQuery(c, overviewQuerySchema);
    if (!q.ok) return q.res;
    return ok(c, presentOverview(await deps.overview.overview(ownerId, q.data.period)));
  });
}

export function dismissAlert(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => {
    const id = idParam(c, "id");
    const alert = id ? await deps.overview.dismissAlert(ownerId, id) : null;
    return alert ? ok(c, presentAlert(alert)) : notFound(c, "Alert");
  });
}

export function getSetup(deps: AgencyControllerDeps) {
  return handle(async (c, ownerId) => ok(c, { steps: await deps.setup.steps(ownerId) }));
}
